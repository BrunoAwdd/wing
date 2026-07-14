import { useCallback, useEffect, useRef, useState } from "react";
import { clearConversation as clearCachedConversation, loadConversation, saveConversation } from "../services/chatCache";

/* global Word, Office, process */

const BACKEND_URL = process.env.BACKEND_URL || "";

export interface ChatMessage {
  author: "user" | "model";
  content: string;
}

interface UseDocumentChatProps {
  isOnline: boolean;
  sessionToken: string | null;
  qualityLevel: string;
  // M4.5: identifica a conta dona do cache local — sem isso, numa máquina
  // compartilhada, outra conta que abrisse o mesmo documento restauraria a
  // conversa da conta anterior.
  accountEmail: string;
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

// Mesma chave gerada uma vez por documento em useAppSetup.ts — reaproveitada
// aqui só pra leitura, nunca gerada de novo (evita perder a associação com
// o cache já salvo por essa mesma instância do documento).
const getDocId = (): string | null => {
  try {
    return (Office.context.document.settings.get("wing_doc_id") as string) || null;
  } catch {
    return null;
  }
};

const MAX_PRIOR_MESSAGES_SENT = 20;

export const useDocumentChat = ({
  isOnline,
  sessionToken,
  qualityLevel,
  accountEmail,
}: UseDocumentChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docIdRef = useRef<string | null>(null);
  // Marca a conta dona do conteúdo atual de `messages` — atualizado sempre
  // que `messages` é setado por algo que sabemos ser dessa conta. O efeito
  // de persistência só salva se isso bater com `accountEmail` atual, senão
  // uma troca de conta salvaria a conversa da conta anterior sob a chave da
  // nova (state de `messages` só reflete a troca no próximo render, mas os
  // efeitos do mesmo commit ainda veem o valor antigo).
  const messagesAccountRef = useRef<string | null>(null);
  // Cancela uma leitura de cache antiga se a conta mudar de novo antes dela
  // resolver — sem isso, uma leitura lenta da conta A podia sobrescrever
  // uma conversa já carregada/em andamento da conta B.
  const loadRequestIdRef = useRef(0);

  // M4.5: reabrir o painel restaura a conversa salva localmente pra esse
  // documento — sem isso, toda vez que o Word fecha/reabre (ou o painel é
  // fechado), a conversa inteira se perde, mesmo que o documento não tenha
  // mudado. A sessão do backend em si (efêmera, ~30min) não é restaurada —
  // só o texto da conversa; uma nova sessão é criada sob demanda quando o
  // usuário manda uma mensagem nova (ensureSession), sem reenviar o
  // histórico antigo pro backend.
  useEffect(() => {
    const requestId = ++loadRequestIdRef.current;
    const docId = getDocId();
    docIdRef.current = docId;

    // Troca de conta (ou conta ainda não resolvida): limpa a conversa em
    // tela IMEDIATAMENTE, antes mesmo da leitura assíncrona — nunca deixa a
    // conversa da conta anterior visível (nem persistível) sob a nova conta.
    setMessages([]);
    setSessionId(null);
    messagesAccountRef.current = accountEmail || null;

    if (!docId || !accountEmail) return;

    void loadConversation(accountEmail, docId).then((cached) => {
      // A conta mudou de novo enquanto essa leitura estava em andamento —
      // descarta o resultado, já não corresponde à conta ativa.
      if (requestId !== loadRequestIdRef.current) return;
      if (cached && cached.length > 0) {
        setMessages(cached);
        messagesAccountRef.current = accountEmail;
      }
    });
  }, [accountEmail]);

  // Persiste a cada mudança de mensagens — barato o suficiente (conversas
  // são pequenas, limitadas pelo backend a WING_CHAT_MAX_MESSAGES). Só
  // salva se `messages` de fato pertence à conta atual (ver
  // `messagesAccountRef` acima) — trava a última linha de defesa contra
  // vazar conversa entre contas numa troca rápida.
  useEffect(() => {
    if (!docIdRef.current || !accountEmail || messages.length === 0) return;
    if (messagesAccountRef.current !== accountEmail) return;
    void saveConversation(accountEmail, docIdRef.current, messages);
  }, [messages, accountEmail]);

  const startAnalysis = useCallback(async () => {
    if (!isOnline || !sessionToken) {
      setError("Ação bloqueada. Verifique sua conexão e sua sessão.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessages([]);
    setSessionId(null);

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
      messagesAccountRef.current = accountEmail;
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
  }, [isOnline, sessionToken, accountEmail]);

  // Reconecta silenciosamente com uma sessão nova quando existe uma
  // conversa restaurada do cache mas nenhuma sessão de backend viva ainda
  // (ex: painel acabou de reabrir). Manda os últimos turnos da conversa
  // restaurada como `priorMessages` pra reconstruir o contexto de verdade —
  // sem isso, uma pergunta que dependesse de uma resposta anterior perdia
  // o contexto completamente. O backend compacta pro mesmo limite de janela
  // usado durante a conversa, então isso nunca vira "reenviar histórico
  // ilimitado" (gate de saída do M4.5).
  const ensureSession = useCallback(async (): Promise<string | null> => {
    if (sessionId) return sessionId;
    if (!isOnline || !sessionToken) {
      setError("Ação bloqueada. Verifique sua conexão e sua sessão.");
      return null;
    }

    const documentText = await getDocumentAsText();
    if (!documentText.trim()) {
      throw new Error("O documento está vazio.");
    }

    const priorMessages = messages.slice(-MAX_PRIOR_MESSAGES_SENT).map((m) => ({
      role: m.author,
      parts: [{ text: m.content }],
    }));

    const response = await fetch(`${BACKEND_URL}/api/v1/chat/start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${sessionToken}`,
      },
      body: JSON.stringify({ documentText, priorMessages }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Falha ao retomar a sessão de chat.");
    }

    const { sessionId: newSessionId } = await response.json();
    setSessionId(newSessionId);
    return newSessionId;
  }, [sessionId, isOnline, sessionToken, messages]);

  const sendMessage = useCallback(
    async (message: string) => {
      let activeSessionId: string | null;
      try {
        activeSessionId = await ensureSession();
      } catch (e: any) {
        setError(e.message || "Ocorreu um erro desconhecido.");
        console.error(e);
        return;
      }
      if (!activeSessionId) return;

      const optimisticMessages: ChatMessage[] = [
        { author: "user", content: message },
        { author: "model", content: "" },
      ];
      messagesAccountRef.current = accountEmail;
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
          body: JSON.stringify({ sessionId: activeSessionId, message, qualityLevel }),
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
    [ensureSession, sessionToken, qualityLevel, accountEmail]
  );

  const clearConversation = useCallback(() => {
    if (docIdRef.current && accountEmail) void clearCachedConversation(accountEmail, docIdRef.current);
    setMessages([]);
    setSessionId(null);
    setError(null);
  }, [accountEmail]);

  return {
    messages,
    isLoading,
    error,
    startAnalysis,
    sendMessage,
    clearConversation,
    hasConversation: messages.length > 0,
  };
};
