import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearConversation as clearCachedConversation,
  loadConversation,
  saveConversation,
} from "../services/chatCache";
import { track } from "../services/telemetry";

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
  // M4.6: identifica esta instância aberta do Word — obrigatório em
  // /chat/start e /chat/message, senão o backend não sabe vincular a
  // sessão de chat a uma instância específica.
  appSessionId: string | null;
  renewAppSession: () => void;
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
  appSessionId,
  renewAppSession,
}: UseDocumentChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const docIdRef = useRef<string | null>(null);
  const appSessionIdRef = useRef<string | null>(appSessionId);
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

  // M4.7: appSessionId pode mudar por trás das cortinas — useAppSession.ts
  // registra uma app session nova, de forma transparente, quando o teto
  // absoluto de 1h é atingido (heartbeats param de renovar a partir daí).
  // Sem isto, `sessionId` continuava apontando pra uma sessão de chat
  // vinculada à app session antiga: a próxima mensagem batia em
  // `app_session_expired` no backend (a app session dona daquele chat já
  // não existe mais) e o usuário via "feche e reabra o painel" mesmo com a
  // renovação já tendo acontecido nos bastidores. Invalida só o VÍNCULO de
  // sessão — a conversa visível (`messages`) não é tocada — e
  // `ensureSession()` relinca silenciosamente com a app session atual na
  // próxima mensagem, igual ao fluxo de restaurar do cache local.
  useEffect(() => {
    appSessionIdRef.current = appSessionId;
    setSessionId(null);
  }, [appSessionId]);

  const startAnalysis = useCallback(async () => {
    if (!isOnline || !sessionToken || !appSessionId) {
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
          "X-Wing-App-Session": appSessionId,
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
  }, [isOnline, sessionToken, accountEmail, appSessionId]);

  // Reconecta silenciosamente com uma sessão nova quando existe uma
  // conversa restaurada do cache mas nenhuma sessão de backend viva ainda
  // (ex: painel acabou de reabrir). Manda os últimos turnos da conversa
  // restaurada como `priorMessages` pra reconstruir o contexto de verdade —
  // sem isso, uma pergunta que dependesse de uma resposta anterior perdia
  // o contexto completamente. O backend compacta pro mesmo limite de janela
  // usado durante a conversa, então isso nunca vira "reenviar histórico
  // ilimitado" (gate de saída do M4.5).
  const ensureSession = useCallback(
    async (
      targetAppSessionId: string | null = appSessionId,
      forceNew = false
    ): Promise<string | null> => {
      if (sessionId && !forceNew) return sessionId;
      if (!isOnline || !sessionToken || !targetAppSessionId) {
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
          "X-Wing-App-Session": targetAppSessionId,
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
    },
    [sessionId, isOnline, sessionToken, messages, appSessionId]
  );

  const sendMessage = useCallback(
    async (message: string) => {
      // M5: latência ponta a ponta medida no cliente, do clique até o fim
      // do stream — inclui qualquer renovação transparente de app session
      // no meio do caminho (o usuário estava esperando o tempo todo, então
      // isso faz parte de ttfb_ms de verdade, não é um "extra" escondido).
      const requestStartedAt = performance.now();
      let firstByteAt: number | null = null;

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

      const requestMessage = (targetSessionId: string, targetAppSessionId: string | null) =>
        fetch(`${BACKEND_URL}/api/v1/chat/message`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${sessionToken}`,
            "X-Wing-App-Session": targetAppSessionId || "",
          },
          body: JSON.stringify({ sessionId: targetSessionId, message, qualityLevel }),
        });

      try {
        const attemptedAppSessionId = appSessionId;
        let response = await requestMessage(activeSessionId, attemptedAppSessionId);

        if (!response.ok || !response.body) {
          const errorData = await response.json();
          // M4.6/M4.7: a app session pode ter expirado no meio da conversa
          // (Word fechado, heartbeat parou, ou uma renovação transparente
          // aconteceu exatamente enquanto esta mensagem estava em voo) —
          // distinto de um erro genérico. useAppSession.ts já deve ter
          // registrado (ou estar registrando) uma app session nova por
          // conta própria; só invalida o vínculo de sessão aqui pra
          // `ensureSession()` relincar na próxima tentativa, sem pedir pro
          // usuário fechar/reabrir o painel manualmente.
          if (errorData.code === "app_session_expired") {
            setSessionId(null);
            renewAppSession();
            const deadline = Date.now() + 15_000;
            while (
              (!appSessionIdRef.current || appSessionIdRef.current === attemptedAppSessionId) &&
              Date.now() < deadline
            ) {
              await new Promise((resolve) => window.setTimeout(resolve, 200));
            }
            const renewedAppSessionId = appSessionIdRef.current;
            if (!renewedAppSessionId || renewedAppSessionId === attemptedAppSessionId) {
              throw new Error("Não foi possível renovar a sessão automaticamente.");
            }
            const renewedChatSessionId = await ensureSession(renewedAppSessionId, true);
            if (!renewedChatSessionId) {
              throw new Error("Não foi possível retomar a conversa.");
            }
            response = await requestMessage(renewedChatSessionId, renewedAppSessionId);
            if (!response.ok || !response.body) {
              const retryError = await response.json();
              throw new Error(
                retryError.error || "Falha ao enviar a mensagem após renovar a sessão."
              );
            }
          } else {
            throw new Error(errorData.error || "Falha ao enviar a mensagem.");
          }
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (firstByteAt === null) firstByteAt = performance.now();

          const chunk = decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const lastMessage = prev[prev.length - 1];
            lastMessage.content += chunk;
            return [...prev.slice(0, -1), lastMessage];
          });
        }

        const completedAt = performance.now();
        const ttfbAt = firstByteAt ?? completedAt;
        track(
          "action_latency",
          {
            command: "chat",
            duration_ms: Math.round(completedAt - requestStartedAt),
            phases: {
              ttfb_ms: Math.round(ttfbAt - requestStartedAt),
              streaming_ms: Math.round(completedAt - ttfbAt),
            },
          },
          sessionToken
        );
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
    [ensureSession, sessionToken, qualityLevel, accountEmail, appSessionId, renewAppSession]
  );

  const clearConversation = useCallback(() => {
    if (docIdRef.current && accountEmail)
      void clearCachedConversation(accountEmail, docIdRef.current);
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
