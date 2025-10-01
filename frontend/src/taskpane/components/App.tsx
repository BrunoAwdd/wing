import * as React from "react";
import { useState, useEffect } from "react";
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
import { track } from "../services/telemetry";
import { useAppSetup } from "../hooks/useAppSetup";
import { useWordInteraction } from "../hooks/useWordInteraction";
import { useAIApi } from "../hooks/useAIApi";

/* global Word, Office, process */

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    padding: "16px",
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground3,
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

  // Estados gerenciados pelo App (orquestrador)
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [showRating, setShowRating] = useState(false);
  const [tone, setTone] = useState("formal");
  const [language, setLanguage] = useState("inglês");

  // Funções de utilidade
  const addLog = (message: string, type: LogEntry["type"]) => {
    const time = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    setLogs((prevLogs) => [...prevLogs, { message, type, time }]);
  };

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
  } = useAIApi({
    licenseToken, isOnline, originalText, tone, language, addLog, showFluentToast
  });

  // Efeito para limpar a sugestão quando o texto original muda
  useEffect(() => {
    setSuggestedText("");
    setIsSuggestionAvailable(false);
  }, [originalText]);

  // Funções de orquestração
  const handleAccept = async () => {
    if (!suggestedText) return;
    track("suggestion_accepted", { command: lastCommand });
    await acceptSuggestion(suggestedText);
    setShowRating(true);
  };

  const handleRate = (rating: number) => {
    track("suggestion_rated", { rating, command: lastCommand });
    addLog(`Avaliação (${rating}) enviada. Obrigado!`, "info");
    setSuggestedText("");
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

  return (
    <div className={styles.root}>
      <StatusBar logs={logs} />
      <DiffViewer originalText={originalText} suggestedText={suggestedText} />
      {showRating ? (
        <Rating onRate={handleRate} />
      ) : (
        <ActionButtonGroup isSuggestionAvailable={isSuggestionAvailable} onAccept={handleAccept} />
      )}
      <CommandConsole
        command={command}
        onCommandChange={setCommand}
        onCommandSend={() => fetchSuggestion(command)}
        onPresetSelect={handlePresetSelect}
        tone={tone}
        language={language}
        onToneChange={setTone}
        onLanguageChange={setLanguage}
      />
    </div>
  );
};

export default App;