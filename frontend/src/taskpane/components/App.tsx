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
import { track } from "../services/telemetry";
import { isLoggedIn, getToken, loginWithOffice } from "../services/authService";

// Garantir que os tipos do Office.js estejam disponí­veis
/* global Word, Office, process, navigator */

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

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

interface AppProps {
  dispatchToast: ReturnType<typeof useToastController>["dispatchToast"];
  toastId: string;
}

const App: React.FC<AppProps> = ({ dispatchToast, toastId }) => {
  const styles = useStyles();

  const [originalText, setOriginalText] = useState("Selecione um texto no documento para começar.");
  const [suggestedText, setSuggestedText] = useState("");
  const [command, setCommand] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSuggestionAvailable, setIsSuggestionAvailable] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isAuthenticated, setIsAuthenticated] = useState(isLoggedIn());
  const [isLoading, setIsLoading] = useState(true);

  const addLog = (message: string, type: LogEntry["type"]) => {
    const time = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setLogs((prevLogs) => [...prevLogs, { message, type, time }]);
  };

  const showFluentToast = (message: string, type: "info" | "success" | "error") => {
    dispatchToast(
      <Toast>
        <ToastTitle>{message}</ToastTitle>
      </Toast>,
      {
        intent: type,
        timeout: 3000,
        toastId: toastId,
      }
    );
  };

  const handleSelectionChange = async () => {
    await Word.run(async (context) => {
      const range = context.document.getSelection();
      range.load("text");
      await context.sync();

      if (range.text.trim() !== "") {
        setOriginalText(range.text);
        setSuggestedText("");
        setIsSuggestionAvailable(false);
        addLog("Texto selecionado. Pronto para um comando.", "info");
      } else {
        setOriginalText("Selecione um texto no documento para começar.");
        setSuggestedText("");
        setIsSuggestionAvailable(false);
        addLog("Pronto.", "info");
      }
    });
  };

  useEffect(() => {
    const authenticate = async () => {
      setIsLoading(true);
      const success = await loginWithOffice();
      setIsAuthenticated(success);
      setIsLoading(false);
      if (!success) {
        showFluentToast("Falha na autenticação com o Office.", "error");
      }
    };

    authenticate();
    track("panel_opened");
    addLog("Bem-vindo ao Wing!", "info");

    // Network status
    const handleOnline = () => {
      setIsOnline(true);
      addLog("Você está online.", "info");
    };
    const handleOffline = () => {
      setIsOnline(false);
      showFluentToast("Você está offline. As funcionalidades de IA estão desativadas.", "error");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      handleSelectionChange,
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          console.error("Falha ao registrar o handler de seleção: " + result.error.message);
          showFluentToast("Falha ao inicializar o monitor de seleção.", "error");
        }
      }
    );
    handleSelectionChange();

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleAccept = async () => {
    if (!suggestedText) return;

    track("suggestion_accepted");
    await Word.run(async (context) => {
      const range = context.document.getSelection();
      range.insertText(suggestedText, Word.InsertLocation.replace);
      range.select(); // Re-seleciona o texto recÃ©m-inserido
      await context.sync();
    });

    addLog("Texto atualizado com sucesso!", "success");
    setSuggestedText("");
    setIsSuggestionAvailable(false);
  };

  const handleCommandSend = async (commandToExecute?: string) => {
    if (!isOnline) {
      showFluentToast("Ação bloqueada. Verifique sua conexão com a internet.", "error");
      return;
    }

    const finalCommand = commandToExecute ?? command;
    addLog(`Enviando comando: "${finalCommand}"`, "info");
    track("prompt_sent", { command: finalCommand, text_length: originalText.length });

    let startTime: number;
    let firstChunkTime: number | null = null;
    let isFirstChunk = true;

    try {
      startTime = Date.now();
      const token = getToken();
      if (!token) {
        showFluentToast("Sessão expirada. Por favor, reinicie o add-in.", "error");
        return;
      }
      const response = await fetch(`${BACKEND_URL}/generate-text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          originalText,
          command: finalCommand,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      let streamedContent = "";
      setSuggestedText(""); // Limpa o texto sugerido anterior
      setIsSuggestionAvailable(true); // Mostra que a sugestÃ£o estÃ¡ sendo gerada

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        if (isFirstChunk) {
          firstChunkTime = Date.now();
          track("ai_first_chunk_received", { duration: firstChunkTime - startTime });
          isFirstChunk = false;
        }

        const chunkText = decoder.decode(value, { stream: true });
        streamedContent += chunkText;
        setSuggestedText(streamedContent.trim());
      }

      const endTime = Date.now();
      track("ai_full_response_received", {
        duration: endTime - startTime,
        response_length: streamedContent.length,
        first_chunk_duration: firstChunkTime ? firstChunkTime - startTime : null,
      });

      addLog("Sugestão recebida!", "success");
    } catch (error) {
      console.error("Erro ao chamar o backend:", error);
      track("error", { type: "backend_error", message: error.message });
      showFluentToast("Erro ao obter sugestão. Verifique o console.", "error");
      setSuggestedText("");
      setIsSuggestionAvailable(false);
    }
  };

  const handlePresetSelect = (presetCommand: string) => {
    setCommand(presetCommand);
    handleCommandSend(presetCommand);
  };

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <Spinner />
        <p>Autenticando com o Office...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className={styles.loading}>
        <p>Falha na autenticação. Por favor, feche e reabra o painel!</p>
      </div>
    );
  }

  return (
    <div className={styles.root}>
      <StatusBar logs={logs} />
      <DiffViewer originalText={originalText} suggestedText={suggestedText} />
      <ActionButtonGroup isSuggestionAvailable={isSuggestionAvailable} onAccept={handleAccept} />
      <CommandConsole
        command={command}
        onCommandChange={setCommand}
        onCommandSend={() => handleCommandSend()}
        onPresetSelect={handlePresetSelect}
      />
    </div>
  );
};

export default App;
