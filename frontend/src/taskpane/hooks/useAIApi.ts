import { useState } from "react";
import { track } from "../services/telemetry";
import { LogEntry } from "../components/StatusBar";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

interface AIApiProps {
  licenseToken: string | null;
  isOnline: boolean;
  originalText: string;
  tone: string;
  language: string;
  addLog: (message: string, type: LogEntry["type"]) => void;
  showFluentToast: (message: string, type: "info" | "success" | "error") => void;
}

export const useAIApi = ({
  licenseToken,
  isOnline,
  originalText,
  tone,
  language,
  addLog,
  showFluentToast,
}: AIApiProps) => {
  const [suggestedText, setSuggestedText] = useState("");
  const [isSuggestionAvailable, setIsSuggestionAvailable] = useState(false);
  const [lastCommand, setLastCommand] = useState(""); // Gerenciar o estado aqui

  const fetchSuggestion = async (commandToExecute: string) => {
    if (isSuggestionAvailable) {
      // Se uma sugestão já está disponível, o usuário a está rejeitando implicitamente.
      track("suggestion_rejected", { command: lastCommand });
    }

    if (!isOnline || !licenseToken || licenseToken === "ERROR_FETCHING_TOKEN") {
      showFluentToast("Ação bloqueada. Verifique sua conexão e o status da licença.", "error");
      return;
    }

    const endpointMapping: { [key: string]: string } = {
      fix: "/api/v1/fix",
      translate: "/api/v1/translate",
      summarize: "/api/v1/summarize",
      rewrite: "/api/v1/rewrite",
    };
    const endpoint = endpointMapping[commandToExecute.toLowerCase()];

    if (!endpoint) {
      showFluentToast(`Comando "${commandToExecute}" não reconhecido.`, "error");
      return;
    }

    setLastCommand(commandToExecute);
    addLog(`Enviando comando: "${commandToExecute}"`, "info");
    track("prompt_sent", { command: commandToExecute, text_length: originalText.length });

    let startTime: number;
    let firstChunkTime: number | null = null;
    let isFirstChunk = true;

    try {
      startTime = Date.now();
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: originalText,
          licenseToken: licenseToken,
          options: { tone, language },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Response body is null");
      }

      let streamedContent = "";
      setSuggestedText("");
      setIsSuggestionAvailable(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

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
      track("error", { type: "backend_error", message: (error as Error).message });
      showFluentToast("Erro ao obter sugestão. Verifique o console.", "error");
      setSuggestedText("");
      setIsSuggestionAvailable(false);
    }
  };

  return { suggestedText, setSuggestedText, isSuggestionAvailable, setIsSuggestionAvailable, fetchSuggestion, lastCommand };
};
