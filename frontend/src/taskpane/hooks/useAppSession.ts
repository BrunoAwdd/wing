import { useEffect, useRef, useState } from "react";

/* global Office, window, process */

const BACKEND_URL = process.env.BACKEND_URL || "";

// M4.6: heartbeat bem mais frequente que o TTL do servidor (padrão 10 min)
// pra tolerar alguns heartbeats perdidos (rede instável, painel em segundo
// plano) sem que a app session expire enquanto a instância do Word
// continua aberta de verdade.
const HEARTBEAT_INTERVAL_MS = 3 * 60 * 1000;

interface UseAppSessionProps {
  sessionToken: string | null;
  isOnline: boolean;
}

const getDocId = (): string | null => {
  try {
    return (Office.context.document.settings.get("wing_doc_id") as string) || null;
  } catch {
    return null;
  }
};

// M4.6: identifica esta instância aberta do Word, independente da sessão de
// login e do documento em si (wing_doc_id é persistido dentro do .docx,
// então duas janelas do mesmo arquivo compartilhariam esse id — o
// appSessionId nunca é persistido, é gerado em memória a cada load do
// painel, exatamente pra diferenciar instâncias). Vincula o chat e os
// caches correspondentes a essa instância, sem impor nenhum limite de
// quantidade — só o saldo de créditos da conta limita o uso.
export const useAppSession = ({ sessionToken, isOnline }: UseAppSessionProps) => {
  const [appSessionId, setAppSessionId] = useState<string | null>(null);
  const appSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionToken || !isOnline) return undefined;

    let cancelled = false;
    let retryTimer: number | undefined;

    // wing_doc_id pode ainda não existir na primeira renderização — ele é
    // criado por useAppSetup.ts de forma assíncrona (settings.saveAsync), e
    // essa criação corre em paralelo com a autenticação, sem ordem
    // garantida. Sem retry aqui, um token que resolve antes do docId travava
    // o registro pra sempre (documentId nunca mais reavaliado, já que não é
    // dependência do efeito) — o usuário ficava bloqueado indefinidamente ao
    // tentar iniciar o chat.
    const attemptRegister = () => {
      if (cancelled) return;
      const documentId = getDocId();
      if (!documentId) {
        retryTimer = window.setTimeout(attemptRegister, 500);
        return;
      }

      void fetch(`${BACKEND_URL}/api/v1/app-sessions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ documentId }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          setAppSessionId(data.appSessionId);
          appSessionIdRef.current = data.appSessionId;
        })
        .catch(() => {
          // Best-effort: se o registro falhar, useDocumentChat trata
          // appSessionId nulo como "ação bloqueada" até uma próxima tentativa
          // (troca de sessionToken/isOnline dispara o efeito de novo).
        });
    };

    attemptRegister();

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, [sessionToken, isOnline]);

  useEffect(() => {
    if (!appSessionId || !sessionToken) return undefined;

    const interval = window.setInterval(() => {
      void fetch(`${BACKEND_URL}/api/v1/app-sessions/${appSessionId}/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      }).catch(() => {
        // Best-effort — o TTL do servidor é quem garante o encerramento
        // real da instância, não o heartbeat em si.
      });
    }, HEARTBEAT_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [appSessionId, sessionToken]);

  useEffect(() => {
    if (!appSessionId || !sessionToken) return undefined;

    // Fechamento explícito, só uma otimização: o Office.js não garante rodar
    // JS quando a instância do Word é encerrada (o WebView2 pode ser
    // derrubado sem chance de completar um fetch) — por isso é best-effort,
    // e a garantia de fato é o TTL por heartbeat no backend. `sendBeacon` não
    // suporta DELETE, então usa `fetch` com `keepalive` (sobrevive à
    // navegação/descarregamento da página, diferente de um fetch comum).
    const closeNow = () => {
      void fetch(`${BACKEND_URL}/api/v1/app-sessions/${appSessionIdRef.current}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", closeNow);
    return () => window.removeEventListener("beforeunload", closeNow);
  }, [appSessionId, sessionToken]);

  return { appSessionId };
};
