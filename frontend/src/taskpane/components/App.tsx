import * as React from "react";
import { useState, useEffect, useCallback } from "react";
import {
  makeStyles,
  tokens,
  Toast,
  ToastTitle,
  useToastController,
  Spinner,
  Button,
  Text,
} from "@fluentui/react-components";
import StatusBar, { LogEntry } from "./StatusBar";
import DiffViewer from "./DiffViewer";
import ActionButtonGroup from "./ActionButtonGroup";
import CommandConsole from "./CommandConsole";
import Rating from "./Rating";
import SettingsPage from "./SettingsPage";
import DocumentAnalysisPage from "./DocumentAnalysisPage";
import MagicLinkLoginPage from "./MagicLinkLoginPage";
import HistoryPage from "./HistoryPage";
import LegalAnalysisPage from "./LegalAnalysisPage";
import DocumentDesignPage from "./DocumentDesignPage";
import { track } from "../services/telemetry";
import { useAppSetup } from "../hooks/useAppSetup";
import { useWordInteraction, Paragraph } from "../hooks/useWordInteraction";
import LastUpdatesPage from "./LastUpdatesPage";
import { useAIApi } from "../hooks/useAIApi";
import { documentObserver } from "../../services/documentObserver";

/* global console, document, setInterval, clearInterval, process */

// RFC 013: Visual Law e análise jurídica estruturada ficam incubadas —
// desligadas por padrão (defaults "false"). Reativação exige configuração
// explícita nos dois lados (frontend .env + backend .env) e novo deploy.
const LEGAL_ANALYSIS_ENABLED = process.env.WING_FEATURE_LEGAL_ANALYSIS === "true";
const DOCUMENT_DESIGN_ENABLED = process.env.WING_FEATURE_DOCUMENT_DESIGN === "true";
const MICROSOFT_SSO_ENABLED = process.env.WING_FEATURE_MICROSOFT_SSO === "true";

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
  const [view, setView] = useState<
    | "main"
    | "settings"
    | "documentAnalysis"
    | "history"
    | "lastUpdates"
    | "legalAnalysis"
    | "documentDesign"
  >("main");

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

  const showFluentToast = useCallback(
    (message: string, type: "info" | "success" | "error") => {
      dispatchToast(
        <Toast>
          <ToastTitle>{message}</ToastTitle>
        </Toast>,
        { intent: type, timeout: 3000, toastId }
      );
    },
    [dispatchToast, toastId]
  );

  // Hooks customizados
  const {
    sessionToken,
    sessionUser,
    authStatus,
    authError,
    retryAuth,
    requestCode,
    verifyCode,
    signOut,
    isOnline,
  } = useAppSetup({ addLog, showFluentToast });
  const {
    originalText,
    acceptSingleSuggestion,
    acceptMultipleSuggestions,
    insertAtCursor,
    insertHtmlAtCursor,
    highlightClauses,
    beautifyTables,
    insertPictureAtCursor,
    applySectionStyles,
    applyDocumentTheme,
    syncDocumentTheme,
    insertTableFromCandidate,
    insertChartAtAnchor,
    isUpdating,
  } = useWordInteraction({ addLog });
  const {
    suggestedText,
    setSuggestedText,
    isSuggestionAvailable,
    setIsSuggestionAvailable,
    fetchSuggestion,
    lastCommand,
    isLoading,
  } = useAIApi({
    sessionToken,
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
    track("suggestion_accepted_all", { command: lastCommand }, sessionToken);

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
    track("suggestion_rejected_all", { command: lastCommand }, sessionToken);
    setSuggestedText([]);
    setIsSuggestionAvailable(false);
    setShowRating(true);
  };

  const handleAcceptSingle = async (id: string) => {
    const suggestion = suggestedText.find((s) => s.id === id);
    if (!suggestion) return;

    const originalIndex = originalText.findIndex((p) => p.id === id);
    if (originalIndex === -1) return;

    track("suggestion_accepted_single", { command: lastCommand }, sessionToken);
    await acceptSingleSuggestion(originalIndex, suggestion.text);
    setSuggestedText((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRejectSingle = (id: string) => {
    track("suggestion_rejected_single", { command: lastCommand }, sessionToken);
    setSuggestedText((prev) => prev.filter((s) => s.id !== id));
  };

  const handleRate = (rating: number) => {
    track("suggestion_rated", { rating, command: lastCommand }, sessionToken);
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
  if (
    !MICROSOFT_SSO_ENABLED &&
    (authStatus === "needs_login" || authStatus === "loading")
  ) {
    return (
      <MagicLinkLoginPage
        isLoading={authStatus === "loading"}
        authError={authError}
        requestCode={requestCode}
        verifyCode={verifyCode}
      />
    );
  }

  if (authStatus === "loading") {
    return (
      <div className={styles.loading}>
        <Spinner />
        <Text>Iniciando sessão segura...</Text>
      </div>
    );
  }

  if (!sessionToken || !sessionUser) {
    return (
      <div className={styles.loading}>
        <Text weight="semibold">Não foi possível entrar no Wing.</Text>
        <Text>{authError || "Sua sessão foi encerrada."}</Text>
        <Button appearance="primary" onClick={() => void retryAuth()}>
          Entrar novamente
        </Button>
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
        user={sessionUser}
        onSignOut={() => void signOut()}
      />
    );
  }

  if (view === "documentAnalysis") {
    return (
      <DocumentAnalysisPage
        onBack={() => setView("main")}
        insertHtmlAtCursor={insertHtmlAtCursor}
        isOnline={isOnline}
        sessionToken={sessionToken}
      />
    );
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

  if (view === "legalAnalysis" && LEGAL_ANALYSIS_ENABLED) {
    return (
      <LegalAnalysisPage
        onBack={() => setView("main")}
        insertHtmlAtCursor={insertHtmlAtCursor}
        isOnline={isOnline}
        sessionToken={sessionToken}
        highlightClauses={highlightClauses}
        beautifyTables={beautifyTables}
        insertPictureAtCursor={insertPictureAtCursor}
      />
    );
  }

  if (view === "documentDesign" && DOCUMENT_DESIGN_ENABLED) {
    return (
      <DocumentDesignPage
        onBack={() => setView("main")}
        isOnline={isOnline}
        sessionToken={sessionToken}
        applySectionStyles={applySectionStyles}
        applyDocumentTheme={applyDocumentTheme}
        syncDocumentTheme={syncDocumentTheme}
        insertTableFromCandidate={insertTableFromCandidate}
        insertChartAtAnchor={insertChartAtAnchor}
        insertHtmlAtCursor={insertHtmlAtCursor}
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
          onShowLegalAnalysis={LEGAL_ANALYSIS_ENABLED ? () => setView("legalAnalysis") : undefined}
          onShowDocumentDesign={DOCUMENT_DESIGN_ENABLED ? () => setView("documentDesign") : undefined}
          onSyncMemory={async () => {
            addLog("Sincronizando memória...", "info");
            await documentObserver.syncDocument();
            track("memory_sync_completed", undefined, sessionToken);
            addLog("Memória sincronizada.", "success");
          }}
        />
      </div>
    </div>
  );
};

export default App;
