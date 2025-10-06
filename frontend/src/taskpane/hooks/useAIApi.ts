import { useEffect, useState } from "react";
import { track } from "../services/telemetry";
import { LogEntry } from "../components/StatusBar";
import * as cache from "../services/suggestionCache";
import { Paragraph } from "./useWordInteraction";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

interface AIApiProps {
  licenseToken: string | null;
  isOnline: boolean;
  originalText: Paragraph[];
  tone: string;
  language: string;
  addLog: (message: string, type: LogEntry["type"]) => void;
  showFluentToast: (message: string, type: "info" | "success" | "error") => void;
  setShowRating: (show: boolean) => void;
}

export const useAIApi = ({
  licenseToken,
  isOnline,
  originalText,
  tone,
  language,
  addLog,
  showFluentToast,
  setShowRating,
}: AIApiProps) => {
  const [suggestedText, setSuggestedText] = useState<Paragraph[]>(cache.getSuggestions());
  const [isSuggestionAvailable, setIsSuggestionAvailable] = useState(cache.getSuggestions().length > 0);
  const [lastCommand, setLastCommand] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Novo estado de loading

  useEffect(() => {
    const suggestions = cache.getSuggestions();
    setSuggestedText(suggestions);
    setIsSuggestionAvailable(suggestions.length > 0);
  }, []);

  const fetchSuggestion = async (commandToExecute: string) => {
    setShowRating(false);

    if (isSuggestionAvailable) {
      track("suggestion_rejected", { command: lastCommand });
    }

    if (!isOnline || !licenseToken || licenseToken === "ERROR_FETCHING_TOKEN") {
      showFluentToast("Ação bloqueada. Verifique sua conexão e o status da licença.", "error");
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
    track("prompt_sent", { command: commandToExecute, text_length: originalText.map(p => p.text).join('\n').length });

    try {
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

      let streamedParagraphs: Paragraph[] = [];
      setSuggestedText([]);
      cache.clearSuggestions();
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
            streamedParagraphs = [...streamedParagraphs, paragraph];
            setSuggestedText([...streamedParagraphs]);
            cache.setSuggestions(streamedParagraphs);
          } catch (e) {
            console.error("Erro ao parsear o JSON do stream:", line, e);
          }
        }
      }
      cache.setSuggestions(streamedParagraphs);
      addLog("Sugestão recebida!", "success");
    } catch (error) {
      console.error("Erro ao chamar o backend:", error);
      track("error", { type: "backend_error", message: (error as Error).message });
      showFluentToast("Erro ao obter sugestão. Verifique o console.", "error");
      setSuggestedText([]);
      setIsSuggestionAvailable(false);
    } finally {
      setIsLoading(false); // Desativa o loading no final
    }
  };

  return { suggestedText, setSuggestedText, isSuggestionAvailable, setIsSuggestionAvailable, fetchSuggestion, lastCommand, isLoading };
};