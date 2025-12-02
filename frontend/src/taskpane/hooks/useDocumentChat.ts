import { useState, useCallback } from "react";

/* global Word, process */

const BACKEND_URL = process.env.BACKEND_URL || "";

export interface ChatMessage {
  author: "user" | "model";
  content: string;
}

// Função auxiliar para ler o documento inteiro como texto puro
const getDocumentAsText = async (): Promise<string> => {
  return await Word.run(async (context) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    return body.text;
  });
};

export const useDocumentChat = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setMessages([]);

    try {
      const documentText = await getDocumentAsText();
      if (!documentText.trim()) {
        throw new Error("O documento está vazio.");
      }

      const response = await fetch(`${BACKEND_URL}/api/v1/chat/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Falha ao iniciar a sessão de chat.");
      }

      const { sessionId: newSessionId } = await response.json();
      setSessionId(newSessionId);
      setMessages([
        {
          author: "model",
          content: "Analisei o documento. O que você gostaria de saber ou fazer?",
        },
      ]);
    } catch (e: any) {
      setError(e.message || "Ocorreu um erro desconhecido.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!sessionId) {
        setError("A sessão de chat não foi iniciada.");
        return;
      }

      setMessages((prev) => [...prev, { author: "user", content: message }]);
      setIsLoading(true);
      setError(null);

      // Adiciona um placeholder para a resposta do modelo
      setMessages((prev) => [...prev, { author: "model", content: "" }]);

      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/chat/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, message }),
        });

        if (!response.ok || !response.body) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Falha ao enviar a mensagem.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            lastMessage.content += chunk;
            return [...prev.slice(0, -1), lastMessage];
          });
        }
      } catch (e: any) {
        setError(e.message || "Ocorreu um erro desconhecido.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  return { messages, isLoading, error, startAnalysis, sendMessage, isSessionStarted: !!sessionId };
};
