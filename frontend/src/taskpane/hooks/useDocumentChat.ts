import { useState, useCallback } from "react";

/* global Word, process */

const BACKEND_URL = process.env.BACKEND_URL || "";

export interface ChatMessage {
  author: "user" | "model";
  content: string;
}

interface UseDocumentChatProps {
  isOnline: boolean;
  sessionToken: string | null;
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

export const useDocumentChat = ({ isOnline, sessionToken }: UseDocumentChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAnalysis = useCallback(async () => {
    if (!isOnline || !sessionToken) {
      setError("Ação bloqueada. Verifique sua conexão e sua sessão.");
      return;
    }

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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
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
  }, [isOnline, sessionToken]);

  const sendMessage = useCallback(
    async (message: string) => {
      if (!sessionId) {
        setError("A sessão de chat não foi iniciada.");
        return;
      }

      const optimisticMessages: ChatMessage[] = [
        { author: "user", content: message },
        { author: "model", content: "" },
      ];
      setMessages((prev) => [...prev, ...optimisticMessages]);
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${BACKEND_URL}/api/v1/chat/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
          },
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
        // O backend também restaura o snapshot anterior em falhas de stream.
        // Remove a pergunta e a resposta otimistas para manter as duas visões
        // do histórico consistentes.
        setMessages((prev) => prev.slice(0, -optimisticMessages.length));
        setError(e.message || "Ocorreu um erro desconhecido.");
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId, sessionToken]
  );

  return { messages, isLoading, error, startAnalysis, sendMessage, isSessionStarted: !!sessionId };
};
