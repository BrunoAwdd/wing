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
  timeoutId: number;
}

export interface AppSessionServiceConfig {
  ttlMs: number;
  now: () => number;
  randomUUID: () => string;
  scheduleExpiration: (callback: () => void, delay: number) => number;
  cancelExpiration: (timeoutId: number) => void;
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(Deno.env.get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const defaultConfig: AppSessionServiceConfig = {
  ttlMs: positiveInteger("WING_APP_SESSION_TTL_MS", 10 * 60 * 1000),
  now: Date.now,
  randomUUID: crypto.randomUUID,
  scheduleExpiration: (callback, delay) => {
    const timeoutId = setTimeout(callback, delay);
    Deno.unrefTimer(timeoutId);
    return timeoutId;
  },
  cancelExpiration: clearTimeout,
};

// Fábrica (não singleton no módulo) pra permitir um mapa isolado por teste
// e injeção das dependências — mesmo padrão de DI usado nos routers e no
// geminiContextCache deste projeto.
export const createAppSessionService = (
  config: AppSessionServiceConfig = defaultConfig,
) => {
  const sessions = new Map<string, AppSession>();

  const remove = (appSessionId: string, session: AppSession) => {
    config.cancelExpiration(session.timeoutId);
    sessions.delete(appSessionId);
  };

  // Nunca rejeita por contagem — "sem limitar dispositivos, pessoas ou
  // sessões por conta" é um requisito comercial explícito do M4.6.
  const register = (accountId: string, documentId: string): AppSession => {
    const appSessionId = config.randomUUID();
    const now = config.now();
    const timeoutId = config.scheduleExpiration(() => {
      sessions.delete(appSessionId);
    }, config.ttlMs);
    const session: AppSession = {
      appSessionId,
      accountId,
      documentId,
      createdAt: now,
      lastHeartbeatAt: now,
      expiresAt: now + config.ttlMs,
      timeoutId,
    };
    sessions.set(appSessionId, session);
    return session;
  };

  // Retorna a sessão só se existir, pertencer à conta informada e não ter
  // expirado — usado tanto pela própria rota de app session quanto por
  // chat.routes.ts pra revalidar o vínculo em /start e /message.
  const validate = (
    appSessionId: string,
    accountId: string,
  ): AppSession | null => {
    const session = sessions.get(appSessionId);
    if (!session || session.accountId !== accountId) return null;
    if (session.expiresAt <= config.now()) {
      remove(appSessionId, session);
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
    session.expiresAt = now + config.ttlMs;
    session.timeoutId = config.scheduleExpiration(() => {
      sessions.delete(appSessionId);
    }, config.ttlMs);
    return session;
  };

  // Idempotente e best-effort: o fechamento explícito do cliente é só uma
  // otimização (encerrar mais cedo do que o TTL naturalmente faria) — nunca
  // é a única garantia de encerramento, já que o Office.js não garante rodar
  // JS no fechamento de todas as instâncias do Word.
  const close = (appSessionId: string, accountId: string): void => {
    const session = sessions.get(appSessionId);
    if (!session || session.accountId !== accountId) return;
    remove(appSessionId, session);
  };

  return { register, validate, heartbeat, close };
};

export type AppSessionService = ReturnType<typeof createAppSessionService>;

export const appSessionService = createAppSessionService();
