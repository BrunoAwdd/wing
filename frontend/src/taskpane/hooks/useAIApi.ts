import { useState } from "react";
import { track } from "../services/telemetry";
import { LogEntry } from "../components/StatusBar";
import * as cache from "../services/suggestionCache";
import { Paragraph } from "./useWordInteraction";
import { addOrUpdateChange } from "../services/pendingChangesCache";
import { estimateCredits, getBillingStatus } from "../services/billingService";

interface AIApiProps {
  sessionToken: string | null;
  isOnline: boolean;
  originalText: Paragraph[];
  tone: string;
  language: string;
  qualityLevel: string;
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
  qualityLevel,
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

    // QUICK_MODEL_ROUTING_PLAN Entrega 3: só "rewrite" aceita nível de
    // qualidade; e só em "Profundo" vale a pena pagar o custo de uma
    // chamada extra pra mostrar estimativa/checar saldo antes de executar.
    const isRewrite = commandToExecute.toLowerCase() === "rewrite";
    if (isRewrite && qualityLevel === "profundo") {
      try {
        const [estimatedCredits, billingStatus] = await Promise.all([
          estimateCredits(sessionToken, originalText, qualityLevel, tone),
          getBillingStatus(sessionToken),
        ]);

        if (billingStatus.usage.creditLimit !== null) {
          const remaining = billingStatus.usage.creditLimit - billingStatus.usage.creditsUsed;
          if (estimatedCredits > remaining) {
            showFluentToast(
              `Saldo insuficiente para o nível Profundo (estimativa: ${estimatedCredits} créditos, restam ${Math.max(remaining, 0)}). Assine o Wing Pro ou reduza o nível de qualidade.`,
              "error"
            );
            return;
          }
        }

        addLog(`Estimativa: ${estimatedCredits} créditos (nível Profundo).`, "info");
      } catch (error) {
        // Estimativa é um auxílio de UX, não um gate de segurança — a cota
        // real já é aplicada no backend antes da chamada de IA (RFC 015
        // §11). Se a estimativa falhar, deixa a execução seguir normalmente.
        console.error("Falha ao estimar créditos:", error);
      }
    }

    setIsLoading(true); // Ativa o loading
    setLastCommand(commandToExecute);
    addLog(`Enviando comando: "${commandToExecute}"`, "info");
    // M5: latência ponta a ponta medida no cliente (clique até fim do
    // stream) + fases — ttfb_ms isola tempo de rede/fila/backend antes do
    // primeiro byte, streaming_ms é só a geração em si. Complementa
    // duration_ms/phases de prompt_completed (que só mede o servidor).
    const requestStartedAt = performance.now();
    let firstByteAt: number | null = null;
    try {
      const response = await fetch(`${BACKEND_URL}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({
          text: originalText,
          options: isRewrite ? { tone, language, qualityLevel } : { tone, language },
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
        if (firstByteAt === null) firstByteAt = performance.now();

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

      const completedAt = performance.now();
      const ttfbAt = firstByteAt ?? completedAt;
      track(
        "action_latency",
        {
          command: commandToExecute.toLowerCase(),
          duration_ms: Math.round(completedAt - requestStartedAt),
          phases: {
            ttfb_ms: Math.round(ttfbAt - requestStartedAt),
            streaming_ms: Math.round(completedAt - ttfbAt),
          },
        },
        sessionToken
      );
    } catch (error) {
      console.error("Erro ao chamar o backend:", error);
      const errorCode =
        error instanceof TypeError
          ? "network_unavailable"
          : (error as Error).message === "Response body is null"
            ? "stream_invalid"
            : "backend_request_failed";
      track(
        "suggestion_failed",
        { command: commandToExecute.toLowerCase(), error_code: errorCode },
        sessionToken
      );
      // Erros com mensagem específica do backend (ex: cota excedida, nível
      // Profundo exige Pro) são mais úteis pro usuário que um texto genérico.
      const errorMessage =
        errorCode === "backend_request_failed" && error instanceof Error && error.message
          ? error.message
          : "Erro ao obter sugestão. Verifique o console.";
      showFluentToast(errorMessage, "error");
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
