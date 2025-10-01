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
import SettingsPage from "./SettingsPage"; // Importar a nova página
import { track } from "../services/telemetry";
import { useAppSetup } from "../hooks/useAppSetup";
import { useWordInteraction, Paragraph } from "../hooks/useWordInteraction";
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
  mainView: { // Container para a visão principal
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    overflowY: "hidden", // Evitar scroll duplo
  },
  content: { // Conteúdo principal que deve ter scroll
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
  const [view, setView] = useState<"main" | "settings">("main");

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
    dispatchToast(<Toast><ToastTitle>{message}</ToastTitle></Toast>, { intent: type, timeout: 3000, toastId });
  };

  // Hooks customizados
  const { licenseToken, isOnline } = useAppSetup({ addLog, showFluentToast });
  const { originalText, acceptSuggestion } = useWordInteraction({ addLog });
  const {
    suggestedText,
    setSuggestedText,
    isSuggestionAvailable,
    setIsSuggestionAvailable,
    fetchSuggestion,
    lastCommand,
    isLoading, // Obter o novo estado
  } = useAIApi({
    licenseToken, isOnline, originalText, tone, language, addLog, showFluentToast, setShowRating
  });

  useEffect(() => {
    setSuggestedText([]);
    setIsSuggestionAvailable(false);
  }, [originalText]);

  const handleAccept = async () => {
    if (suggestedText.length === 0) return;
    track("suggestion_accepted", { command: lastCommand });
    await acceptSuggestion(suggestedText);
    setShowRating(true);
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
            <DiffViewer originalText={originalText} suggestedText={suggestedText} />
          )}
          {showRating ? (
            <Rating onRate={handleRate} />
          ) : (
            <ActionButtonGroup isSuggestionAvailable={isSuggestionAvailable} onAccept={handleAccept} />
          )}
        </div>
        <CommandConsole
          command={command}
          onCommandChange={setCommand}
          onCommandSend={() => fetchSuggestion(command)}
          onPresetSelect={handlePresetSelect}
          onShowSettings={() => setView("settings")}
        />
      </div>
    </div>
  );
};

export default App;