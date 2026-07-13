import { useState } from "react";
import { track } from "../services/telemetry";
import { LogEntry } from "../components/StatusBar";
import * as cache from "../services/suggestionCache";
import { Paragraph } from "./useWordInteraction";
import { addOrUpdateChange } from "../services/pendingChangesCache";

interface AIApiProps {
  sessionToken: string | null;
  isOnline: boolean;
  originalText: Paragraph[];
  tone: string;
  language: string;
  addLog: (message: string, type: LogEntry["type"]) => void;
  showFluentToast: (message: string, type: "info" | "success" | "error") => void;
  setShowRating: (show: boolean) => void;
}

const BACKEND_URL = process.env.BACKEND_URL || "";

export const useAIApi = ({
  sessionToken,
  isOnline,
  originalText,
  tone,
  language,
  addLog,
  showFluentToast,
  setShowRating,
}: AIApiProps) => {
  const [suggestedText, setSuggestedText] = useState<Paragraph[]>([]);
  const [isSuggestionAvailable, setIsSuggestionAvailable] = useState(false);
  const [lastCommand, setLastCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Novo estado de loading

  const fetchSuggestion = async (commandToExecute: string) => {
    setShowRating(false);

    if (isSuggestionAvailable) {
      track("suggestion_rejected", { command: lastCommand }, sessionToken);
    }

    if (!isOnline || !sessionToken) {
      showFluentToast("Ação bloqueada. Verifique sua conexão e sua sessão.", "error");
      return;
    }
    if (originalText.length === 0) {
      showFluentToast("Por favor, selecione um texto para continuar.", "error");
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

    setIsLoading(true); // Ativa o loading
    setLastCommand(commandToExecute);
    addLog(`Enviando comando: "${commandToExecute}"`, "info");
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          text: originalText,
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

      let streamedParagraphs: Paragraph[] = [];
      setSuggestedText([]);
      setIsSuggestionAvailable(true);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkText = decoder.decode(value, { stream: true });
        buffer += chunkText;
        const lines = buffer.split("\n");

        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.trim() === "") continue;
          try {
            const paragraph = JSON.parse(line);
            const originalParagraph = originalText.find((p) => p.id === paragraph.id);
            if (originalParagraph) {
              addOrUpdateChange({
                id: paragraph.id,
                original: originalParagraph,
                suggestion: paragraph,
                status: "pending",
              });
            }
            streamedParagraphs = [...streamedParagraphs, paragraph];
            setSuggestedText([...streamedParagraphs]);
          } catch (e) {
            console.error("Erro ao parsear o JSON do stream:", line, e);
          }
        }
      }

      cache.saveSuggestion(originalText, commandToExecute, streamedParagraphs);
      addLog("Sugestão recebida!", "success");
    } catch (error) {
      console.error("Erro ao chamar o backend:", error);
      const errorCode = error instanceof TypeError
        ? "network_unavailable"
        : (error as Error).message === "Response body is null"
        ? "stream_invalid"
        : "backend_request_failed";
      track(
        "suggestion_failed",
        { command: commandToExecute.toLowerCase(), error_code: errorCode },
        sessionToken
      );
      showFluentToast("Erro ao obter sugestão. Verifique o console.", "error");
      setSuggestedText([]);
      setIsSuggestionAvailable(false);
    } finally {
      setIsLoading(false); // Desativa o loading no final
    }
  };

  return {
    suggestedText,
    setSuggestedText,
    isSuggestionAvailable,
    setIsSuggestionAvailable,
    fetchSuggestion,
    lastCommand,
    isLoading,
  };
};
