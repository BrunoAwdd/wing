import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  makeStyles,
  tokens,
  Toast,
  ToastTitle,
  useToastController,
  Spinner,
} from "@fluentui/react-components";
import StatusBar, { LogEntry } from "./StatusBar";
import DiffViewer from "./DiffViewer";
import ActionButtonGroup from "./ActionButtonGroup";
import CommandConsole from "./CommandConsole";
import Rating from "./Rating";
import SettingsPage from "./SettingsPage";
import DocumentAnalysisPage from "./DocumentAnalysisPage";
import HistoryPage from "./HistoryPage";
import { track } from "../services/telemetry";
import { useAppSetup } from "../hooks/useAppSetup";
import { useWordInteraction, Paragraph } from "../hooks/useWordInteraction";
import LastUpdatesPage from "./LastUpdatesPage";
import { useAIApi } from "../hooks/useAIApi";

/* global process */

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground3,
  },
  mainView: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    overflowY: "hidden",
  },
  content: {
    flexGrow: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    padding: "0 16px",
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100vh",
    gap: "16px",
  },
});

interface AppProps {
  dispatchToast: ReturnType<typeof useToastController>["dispatchToast"];
  toastId: string;
}

const App: React.FC<AppProps> = ({ dispatchToast, toastId }) => {
  const styles = useStyles();

  // Estado de navegação
  const [view, setView] = useState<"main" | "settings" | "documentAnalysis" | "history" | "lastUpdates">("main");

  // Estados gerenciados pelo App
  const [command, setCommand] = useState("fix");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showRating, setShowRating] = useState(false);
  const [tone, setTone] = useState("formal");
  const [language, setLanguage] = useState("inglês");

  const addLog = useCallback((message: string, type: LogEntry["type"]) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setLogs((prevLogs) => [...prevLogs, { message, type, time }]);
  }, []);

  const showFluentToast = (message: string, type: "info" | "success" | "error") => {
    dispatchToast(
      <Toast>
        <ToastTitle>{message}</ToastTitle>
      </Toast>,
      { intent: type, timeout: 3000, toastId }
    );
  };

  // Hooks customizados
  const { licenseToken, isOnline } = useAppSetup({ addLog, showFluentToast });
  const { originalText, acceptSingleSuggestion, acceptMultipleSuggestions, insertAtCursor, insertHtmlAtCursor, isUpdating } = useWordInteraction({ addLog });
  const {
    suggestedText,
    setSuggestedText,
    isSuggestionAvailable,
    setIsSuggestionAvailable,
    fetchSuggestion,
    lastCommand,
    isLoading,
  } = useAIApi({
    licenseToken,
    isOnline,
    originalText,
    tone,
    language,
    addLog,
    showFluentToast,
    setShowRating,
  });

  useEffect(() => {
    if (isUpdating) return;
    setSuggestedText([]);
    setIsSuggestionAvailable(false);
  }, [originalText]);

  const handleAcceptAll = async () => {
    if (suggestedText.length === 0) return;
    track("suggestion_accepted_all", { command: lastCommand });

    const suggestionsToApply = suggestedText
      .map((suggestion) => {
        const originalIndex = originalText.findIndex((p) => p.id === suggestion.id);
        if (originalIndex === -1) {
          return null;
        }
        return { index: originalIndex, text: suggestion.text };
      })
      .filter((s) => s !== null);

    if (suggestionsToApply.length > 0) {
      await acceptMultipleSuggestions(suggestionsToApply);
    }

    setSuggestedText([]);
    setIsSuggestionAvailable(false);
  };

  const handleRejectAll = () => {
    if (suggestedText.length === 0) return;
    track("suggestion_rejected_all", { command: lastCommand });
    setSuggestedText([]);
    setIsSuggestionAvailable(false);
    setShowRating(true);
  };

  const handleAcceptSingle = async (id: string) => {
    const suggestion = suggestedText.find((s) => s.id === id);
    if (!suggestion) return;

    const originalIndex = originalText.findIndex((p) => p.id === id);
    if (originalIndex === -1) return;

    track("suggestion_accepted_single", { command: lastCommand });
    await acceptSingleSuggestion(originalIndex, suggestion.text);
    setSuggestedText((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRejectSingle = (id: string) => {
    track("suggestion_rejected_single", { command: lastCommand });
    setSuggestedText((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRate = (rating: number) => {
    track("suggestion_rated", { rating, command: lastCommand });
    addLog(`Avaliação (${rating}) enviada.`, "info");
    setSuggestedText([]);
    setIsSuggestionAvailable(false);
    setShowRating(false);
  };

  const handlePresetSelect = (presetCommand: string) => {
    setCommand(presetCommand);
    fetchSuggestion(presetCommand);
  };

  // Renderização
  if (!licenseToken) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Obtendo token de licença...</p>
      </div>
    );
  }

  if (view === "settings") {
    return (
      <SettingsPage
        tone={tone}
        language={language}
        onToneChange={setTone}
        onLanguageChange={setLanguage}
        onBack={() => setView("main")}
      />
    );
  }

  if (view === "documentAnalysis") {
    return <DocumentAnalysisPage onBack={() => setView("main")} insertHtmlAtCursor={insertHtmlAtCursor} />;
  }

  if (view === "history") {
    return <HistoryPage onBack={() => setView("main")} insertAtCursor={insertAtCursor} />;
  }

  if (view === "lastUpdates") {
    return (
      <LastUpdatesPage
        onBack={() => setView("main")}
        acceptSingleSuggestion={acceptSingleSuggestion}
        originalText={originalText}
      />
    );
  }

  return (
    <div className={styles.root}>
      <StatusBar logs={logs} />
      <div className={styles.mainView}>
        <div className={styles.content}>
          {isLoading ? (
            <div className={styles.loading}>
              <Spinner />
              <p>Processando...</p>
            </div>
          ) : (
            <DiffViewer
              originalText={originalText}
              suggestedText={suggestedText}
              onAcceptSingle={handleAcceptSingle}
              onRejectSingle={handleRejectSingle}
            />
          )}
          {showRating ? (
            <Rating onRate={handleRate} />
          ) : (
            <ActionButtonGroup
              isSuggestionAvailable={isSuggestionAvailable}
              onAccept={handleAcceptAll}
              onReject={handleRejectAll}
            />
          )}
        </div>
        <CommandConsole
          command={command}
          onCommandChange={setCommand}
          onCommandSend={() => fetchSuggestion(command)}
          onPresetSelect={handlePresetSelect}
          onShowSettings={() => setView("settings")}
          onStartAnalysis={() => setView("documentAnalysis")}
          onShowHistory={() => setView("history")}
          onShowLastUpdates={() => setView("lastUpdates")}
        />
      </div>
    </div>
  );
};

export default App;
