import { useCallback, useEffect, useRef, useState } from "react";

/* global Office, window, process */

const BACKEND_URL = process.env.BACKEND_URL || "";

// M4.6: heartbeat bem mais frequente que o TTL rolante do servidor (padrão
// 10 min) pra tolerar alguns heartbeats perdidos (rede instável, painel em
// segundo plano) sem que a app session expire enquanto a instância do Word
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
//
// M4.7: o servidor limita cada app session a 1h de duração absoluta — a
// partir daí, nenhum heartbeat renova mais, mesmo que o Word continue
// aberto. Este hook detecta isso (heartbeat retornando não-ok) e registra
// uma app session nova de forma transparente: a conversa visível não
// depende do appSessionId (fica em chatCache, isolada por conta+documento),
// então o usuário nunca percebe a troca.
export const useAppSession = ({ sessionToken, isOnline }: UseAppSessionProps) => {
  const [appSessionId, setAppSessionId] = useState<string | null>(null);
  const [renewGeneration, setRenewGeneration] = useState(0);
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
    const register = () => {
      if (cancelled) return;
      const documentId = getDocId();
      if (!documentId) {
        retryTimer = window.setTimeout(register, 500);
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
        .then(async (response) => {
          if (response.ok) return response.json();
          // Resposta HTTP recebida mas rejeitada (401 de token ainda não
          // propagado, 500 transitório etc.) — isto NÃO cai no .catch()
          // abaixo (a promise resolve normalmente), então sem este ramo o
          // registro desistia pra sempre em silêncio: nenhum retry, nenhum
          // log, e o chat ficava bloqueado ("ação bloqueada") indefinidamente
          // mesmo esperando, já que só falha de rede tinha retry.
          console.warn(
            `[useAppSession] Falha ao registrar app session (HTTP ${response.status}). Tentando de novo em breve.`
          );
          throw new Error(`app_session_register_failed_${response.status}`);
        })
        .then((data) => {
          if (cancelled || !data) return;
          setAppSessionId(data.appSessionId);
          appSessionIdRef.current = data.appSessionId;
        })
        .catch(() => {
          // Falha de rede/servidor (ou resposta não-ok tratada acima) no
          // registro inicial — sem retry aqui, o chat ficava bloqueado
          // ("ação bloqueada") até o usuário trocar de conta ou
          // conectividade, já que o heartbeat (a única outra coisa que
          // tentaria de novo) só reage a heartbeat FALHO de uma sessão que
          // já existe — nunca ajuda quando o registro em si nunca chegou a
          // acontecer. Tenta de novo em breve.
          if (!cancelled) retryTimer = window.setTimeout(register, 5_000);
        });
    };

    const heartbeat = () => {
      const currentId = appSessionIdRef.current;
      if (!currentId) {
        // Nunca registrou (ou a última tentativa falhou e o retryTimer se
        // perdeu por algum motivo) — o heartbeat funciona como uma rede de
        // segurança adicional pra tentar de novo, não só o retryTimer.
        register();
        return;
      }

      void fetch(`${BACKEND_URL}/api/v1/app-sessions/${currentId}/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionToken}` },
      })
        .then((response) => {
          if (cancelled || response.ok) return;
          // M4.7: heartbeat rejeitado (404 — teto absoluto de 1h atingido,
          // ou a sessão já não existe por outro motivo). Registra uma app
          // session nova imediatamente, em vez de continuar batendo numa
          // sessão morta até o usuário notar o chat bloqueado.
          appSessionIdRef.current = null;
          setAppSessionId(null);
          register();
        })
        .catch(() => {
          // Falha de rede pontual — não força reconexão aqui; a janela
          // rolante do servidor (bem maior que este intervalo) tolera
          // algumas falhas seguidas antes de expirar de verdade.
        });
    };

    register();
    const heartbeatInterval = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
      window.clearInterval(heartbeatInterval);
    };
  }, [sessionToken, isOnline, renewGeneration]);

  useEffect(() => {
    if (!sessionToken) return undefined;

    // Fechamento explícito, só uma otimização: o Office.js não garante rodar
    // JS quando a instância do Word é encerrada (o WebView2 pode ser
    // derrubado sem chance de completar um fetch) — por isso é best-effort,
    // e a garantia de fato é o TTL por heartbeat no backend. `sendBeacon` não
    // suporta DELETE, então usa `fetch` com `keepalive` (sobrevive à
    // navegação/descarregamento da página, diferente de um fetch comum). Lê
    // `appSessionIdRef` (não o state) pra sempre pegar o id mais recente,
    // mesmo que uma renovação transparente tenha trocado o id no meio da
    // sessão.
    const closeNow = () => {
      if (!appSessionIdRef.current) return;
      void fetch(`${BACKEND_URL}/api/v1/app-sessions/${appSessionIdRef.current}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${sessionToken}` },
        keepalive: true,
      }).catch(() => {});
    };

    window.addEventListener("beforeunload", closeNow);
    return () => window.removeEventListener("beforeunload", closeNow);
  }, [sessionToken]);

  const renewAppSession = useCallback(() => {
    appSessionIdRef.current = null;
    setAppSessionId(null);
    setRenewGeneration((generation) => generation + 1);
  }, []);

  return { appSessionId, renewAppSession };
};
