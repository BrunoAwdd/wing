import { geminiContextCache } from "./geminiContextCache.ts";

// M4.6: isola cada instância aberta do Word (appSessionId) da sessão de
// login (M1) e da sessão de chat (M3). Sem isso, fechar uma instância do
// Word não encerrava nada no backend — o chat só expirava pelo seu próprio
// TTL, independente do documento continuar aberto ou não. Nunca aplica cap
// por conta: qualquer quantidade de instâncias é permitida, o único limite
// real é o saldo de créditos (M4.4).

export interface AppSession {
  appSessionId: string;
  accountId: string;
  documentId: string;
  createdAt: number;
  lastHeartbeatAt: number;
  expiresAt: number;
  // M4.7: teto absoluto — diferente de `expiresAt` (janela rolante,
  // renovada a cada heartbeat), isso nunca muda depois do `register()`.
  // Sem isso, heartbeats a cada 3min mantinham a sessão viva pra sempre,
  // enquanto o Word ficasse aberto — sem limite real de duração.
  absoluteExpiresAt: number;
  timeoutId: number;
}

export interface AppSessionServiceConfig {
  ttlMs: number;
  maxDurationMs: number;
  now: () => number;
  randomUUID: () => string;
  scheduleExpiration: (callback: () => void, delay: number) => number;
  cancelExpiration: (timeoutId: number) => void;
  // M4.7: chamado exatamente uma vez por fim de app session, qualquer que
  // seja o caminho (TTL rolante, teto absoluto, fechamento explícito) — sem
  // isso, o cache remoto de prompt (Gemini) dessa instância continuava
  // armazenado e potencialmente cobrado até seu próprio TTL vencer, mesmo
  // sem nenhuma sessão que pudesse reutilizá-lo.
  onSessionEnd: (appSessionId: string) => void;
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(Deno.env.get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const defaultConfig: AppSessionServiceConfig = {
  ttlMs: positiveInteger("WING_APP_SESSION_TTL_MS", 10 * 60 * 1000),
  // M4.7: "limitar cada app session a uma hora de duração absoluta, sem
  // permitir que heartbeats renovem esse prazo indefinidamente".
  maxDurationMs: positiveInteger("WING_APP_SESSION_MAX_DURATION_MS", 60 * 60 * 1000),
  now: Date.now,
  randomUUID: crypto.randomUUID,
  scheduleExpiration: (callback, delay) => {
    const timeoutId = setTimeout(callback, delay);
    Deno.unrefTimer(timeoutId);
    return timeoutId;
  },
  cancelExpiration: clearTimeout,
  onSessionEnd: (appSessionId) => {
    geminiContextCache.invalidateAppSession(appSessionId).catch((error) => {
      console.error(
        "[AppSessionService] Falha ao invalidar cache remoto da app session:",
        error,
      );
    });
  },
};

// Fábrica (não singleton no módulo) pra permitir um mapa isolado por teste
// e injeção das dependências — mesmo padrão de DI usado nos routers e no
// geminiContextCache deste projeto.
export const createAppSessionService = (
  config: AppSessionServiceConfig = defaultConfig,
) => {
  const sessions = new Map<string, AppSession>();

  // Único ponto de saída de uma sessão do mapa — garante que `onSessionEnd`
  // dispara exatamente uma vez por sessão, não importa se o encerramento
  // veio do timer de expiração, de um heartbeat rejeitado ou de um
  // fechamento explícito.
  const expireSession = (appSessionId: string, session: AppSession) => {
    config.cancelExpiration(session.timeoutId);
    sessions.delete(appSessionId);
    config.onSessionEnd(appSessionId);
  };

  // Nunca rejeita por contagem — "sem limitar dispositivos, pessoas ou
  // sessões por conta" é um requisito comercial explícito do M4.6.
  const register = (accountId: string, documentId: string): AppSession => {
    const appSessionId = config.randomUUID();
    const now = config.now();
    const absoluteExpiresAt = now + config.maxDurationMs;
    const expiresAt = Math.min(now + config.ttlMs, absoluteExpiresAt);
    const timeoutId = config.scheduleExpiration(() => {
      const session = sessions.get(appSessionId);
      if (session) expireSession(appSessionId, session);
    }, expiresAt - now);
    const session: AppSession = {
      appSessionId,
      accountId,
      documentId,
      createdAt: now,
      lastHeartbeatAt: now,
      expiresAt,
      absoluteExpiresAt,
      timeoutId,
    };
    sessions.set(appSessionId, session);
    return session;
  };

  // Retorna a sessão só se existir, pertencer à conta informada e não ter
  // expirado (pela janela rolante OU pelo teto absoluto) — usado tanto pela
  // própria rota de app session quanto por chat.routes.ts pra revalidar o
  // vínculo em /start e /message.
  const validate = (
    appSessionId: string,
    accountId: string,
  ): AppSession | null => {
    const session = sessions.get(appSessionId);
    if (!session || session.accountId !== accountId) return null;
    const now = config.now();
    if (session.expiresAt <= now || session.absoluteExpiresAt <= now) {
      expireSession(appSessionId, session);
      return null;
    }
    return session;
  };

  const heartbeat = (
    appSessionId: string,
    accountId: string,
  ): AppSession | null => {
    const session = validate(appSessionId, accountId);
    if (!session) return null;

    config.cancelExpiration(session.timeoutId);
    const now = config.now();
    session.lastHeartbeatAt = now;
    // M4.7: nunca renova além do teto absoluto — a partir daí, o próximo
    // heartbeat (ou /start) encontra a sessão já expirada (checagem em
    // `validate` acima) e o cliente precisa registrar uma nova (renovação
    // transparente, ver useAppSession.ts no frontend).
    session.expiresAt = Math.min(now + config.ttlMs, session.absoluteExpiresAt);
    session.timeoutId = config.scheduleExpiration(() => {
      const current = sessions.get(appSessionId);
      if (current) expireSession(appSessionId, current);
    }, session.expiresAt - now);
    return session;
  };

  // Idempotente e best-effort: o fechamento explícito do cliente é só uma
  // otimização (encerrar mais cedo do que o TTL naturalmente faria) — nunca
  // é a única garantia de encerramento, já que o Office.js não garante rodar
  // JS no fechamento de todas as instâncias do Word.
  const close = (appSessionId: string, accountId: string): void => {
    const session = sessions.get(appSessionId);
    if (!session || session.accountId !== accountId) return;
    expireSession(appSessionId, session);
  };

  return { register, validate, heartbeat, close };
};

export type AppSessionService = ReturnType<typeof createAppSessionService>;

export const appSessionService = createAppSessionService();
