import { type Context, Router } from "../deps.ts";
import { generateChatStream } from "../services/aiService.ts";
import { billingService } from "../services/billingService.ts";
import { track } from "../services/telemetry.ts";
import {
  getWingAuth,
  requireWingSession,
} from "../middlewares/authMiddleware.ts";

export interface ChatHistoryEntry {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface ChatSession {
  accountId: string;
  createdAt: number;
  expiresAt: number;
  history: ChatHistoryEntry[];
  inFlight: boolean;
  messageCount: number;
  timeoutId: number;
}

export interface ChatLimits {
  maxDocumentChars: number;
  maxMessageChars: number;
  maxMessages: number;
  maxSessionsPerAccount: number;
  sessionTtlMs: number;
}

export interface ChatRouteDependencies {
  generateStream: typeof generateChatStream;
  getEntitlement: typeof billingService.getEntitlement;
  incrementUsage: typeof billingService.incrementUsage;
  isAccountRevoked: typeof billingService.isAccountRevoked;
  now: () => number;
  randomUUID: () => string;
  scheduleExpiration: (callback: () => void, delay: number) => number;
  cancelExpiration: (timeoutId: number) => void;
  trackEvent: typeof track;
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(Deno.env.get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const defaultLimits: ChatLimits = {
  maxDocumentChars: positiveInteger("WING_CHAT_MAX_DOCUMENT_CHARS", 120_000),
  maxMessageChars: positiveInteger("WING_CHAT_MAX_MESSAGE_CHARS", 4_000),
  maxMessages: positiveInteger("WING_CHAT_MAX_MESSAGES", 30),
  maxSessionsPerAccount: positiveInteger(
    "WING_CHAT_MAX_SESSIONS_PER_ACCOUNT",
    3,
  ),
  sessionTtlMs: positiveInteger("WING_CHAT_SESSION_TTL_MS", 30 * 60 * 1000),
};

const defaultDependencies: ChatRouteDependencies = {
  generateStream: generateChatStream,
  getEntitlement: billingService.getEntitlement,
  incrementUsage: billingService.incrementUsage,
  isAccountRevoked: billingService.isAccountRevoked,
  now: Date.now,
  randomUUID: crypto.randomUUID,
  scheduleExpiration: (callback, delay) => {
    const timeoutId = setTimeout(callback, delay);
    Deno.unrefTimer(timeoutId);
    return timeoutId;
  },
  cancelExpiration: clearTimeout,
  trackEvent: track,
};

const readJson = async (
  ctx: Context,
): Promise<Record<string, unknown> | null> => {
  try {
    return await ctx.request.body.json() as Record<string, unknown>;
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "Corpo JSON inválido." };
    return null;
  }
};

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

export const createChatRouter = (
  dependencies: ChatRouteDependencies = defaultDependencies,
  limits: ChatLimits = defaultLimits,
) => {
  const router = new Router();
  const sessions = new Map<string, ChatSession>();

  const removeExpiredSessions = () => {
    const now = dependencies.now();
    for (const [sessionId, session] of sessions) {
      if (session.expiresAt <= now) {
        dependencies.cancelExpiration(session.timeoutId);
        sessions.delete(sessionId);
      }
    }
  };

  router.use(requireWingSession);

  router.post("/start", async (ctx) => {
    const body = await readJson(ctx);
    if (!body) return;

    const { documentText } = body;
    if (!isNonEmptyString(documentText)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "documentText é obrigatório." };
      return;
    }
    if (documentText.length > limits.maxDocumentChars) {
      ctx.response.status = 413;
      ctx.response.body = {
        error:
          `O documento excede o limite de ${limits.maxDocumentChars} caracteres.`,
        code: "chat_document_too_large",
      };
      return;
    }

    const auth = getWingAuth(ctx);
    if (await dependencies.isAccountRevoked(auth.accountId)) {
      ctx.response.status = 403;
      ctx.response.body = {
        error: "Esta conta está revogada.",
        code: "account_revoked",
      };
      return;
    }
    const entitlement = await dependencies.getEntitlement(auth.accountId);
    removeExpiredSessions();

    const activeSessionCount = [...sessions.values()].filter((session) =>
      session.accountId === auth.accountId
    ).length;
    if (activeSessionCount >= limits.maxSessionsPerAccount) {
      ctx.response.status = 429;
      ctx.response.body = {
        error: "Limite de sessões de chat simultâneas atingido.",
        code: "chat_session_limit",
      };
      return;
    }

    const now = dependencies.now();
    const sessionId = dependencies.randomUUID();
    const timeoutId = dependencies.scheduleExpiration(() => {
      sessions.delete(sessionId);
    }, limits.sessionTtlMs);
    sessions.set(sessionId, {
      accountId: auth.accountId,
      createdAt: now,
      expiresAt: now + limits.sessionTtlMs,
      history: [
        {
          role: "user",
          parts: [{
            text:
              `Você é um assistente especialista neste documento. Analise o conteúdo a seguir e prepare-se para responder perguntas sobre ele. O documento é:\n\n---\n${documentText}\n---`,
          }],
        },
        {
          role: "model",
          parts: [{
            text:
              "Entendido. Analisei o documento e estou pronto para responder suas perguntas.",
          }],
        },
      ],
      inFlight: false,
      messageCount: 0,
      timeoutId,
    });

    dependencies.trackEvent(
      "chat_session_started",
      { entitlement: entitlement.plan, document_chars: documentText.length },
      auth.accountId,
    );
    ctx.response.status = 201;
    ctx.response.body = {
      sessionId,
      expiresAt: new Date(now + limits.sessionTtlMs).toISOString(),
    };
  });

  router.post("/message", async (ctx) => {
    const body = await readJson(ctx);
    if (!body) return;

    const { sessionId, message } = body;
    if (!isNonEmptyString(sessionId) || !isNonEmptyString(message)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "sessionId e message são obrigatórios." };
      return;
    }
    if (message.length > limits.maxMessageChars) {
      ctx.response.status = 413;
      ctx.response.body = {
        error:
          `A mensagem excede o limite de ${limits.maxMessageChars} caracteres.`,
        code: "chat_message_too_large",
      };
      return;
    }

    const auth = getWingAuth(ctx);
    const session = sessions.get(sessionId);
    if (
      !session || session.accountId !== auth.accountId ||
      session.expiresAt <= dependencies.now()
    ) {
      if (session?.expiresAt && session.expiresAt <= dependencies.now()) {
        dependencies.cancelExpiration(session.timeoutId);
        sessions.delete(sessionId);
      }
      ctx.response.status = 404;
      ctx.response.body = {
        error: "Sessão de chat não encontrada ou expirada.",
      };
      return;
    }
    if (session.inFlight) {
      ctx.response.status = 409;
      ctx.response.body = {
        error: "Aguarde a resposta atual antes de enviar outra mensagem.",
        code: "chat_message_in_progress",
      };
      return;
    }
    if (session.messageCount >= limits.maxMessages) {
      ctx.response.status = 429;
      ctx.response.body = {
        error: "Limite de mensagens desta sessão atingido.",
        code: "chat_message_limit",
      };
      return;
    }

    // O lock precisa acontecer antes de qualquer await. Caso contrário, duas
    // requisições podem atravessar a checagem acima enquanto consultam banco e
    // iniciar streams concorrentes sobre o mesmo histórico.
    session.inFlight = true;

    let entitlement: Awaited<ReturnType<typeof dependencies.getEntitlement>>;
    try {
      if (await dependencies.isAccountRevoked(auth.accountId)) {
        ctx.response.status = 403;
        ctx.response.body = {
          error: "Esta conta está revogada.",
          code: "account_revoked",
        };
        session.inFlight = false;
        return;
      }

      entitlement = await dependencies.getEntitlement(auth.accountId);
      const freeMonthlyLimit = positiveInteger(
        "WING_FREE_MONTHLY_REQUESTS",
        20,
      );
      const estimatedTokens = Math.ceil(message.length / 4);
      const usageLimit = entitlement.plan === "free" ? freeMonthlyLimit : null;
      const usage = await dependencies.incrementUsage(
        auth.accountId,
        estimatedTokens,
        usageLimit,
      );
      if (!usage.allowed) {
        ctx.response.status = 402;
        ctx.response.body = {
          error:
            "Limite mensal do plano Free atingido. Assine o Wing Pro para continuar.",
          code: "quota_exceeded",
        };
        session.inFlight = false;
        return;
      }
    } catch (error) {
      session.inFlight = false;
      throw error;
    }

    const trimmedMessage = message.trim();
    const historyBeforeMessage = session.history.slice();
    const stream = dependencies.generateStream(
      trimmedMessage,
      historyBeforeMessage,
      { entitlement: entitlement.plan },
    );
    session.history.push({ role: "user", parts: [{ text: trimmedMessage }] });

    ctx.response.status = 200;
    ctx.response.body = (async function* () {
      let completeResponse = "";
      try {
        for await (const chunk of stream) {
          completeResponse += chunk;
          yield chunk;
        }

        session.history.push({
          role: "model",
          parts: [{ text: completeResponse }],
        });
        session.messageCount += 1;
        dependencies.trackEvent(
          "chat_message_completed",
          {
            entitlement: entitlement.plan,
            message_chars: trimmedMessage.length,
            response_chars: completeResponse.length,
            session_message_count: session.messageCount,
          },
          session.accountId,
        );
      } catch (error) {
        session.history = historyBeforeMessage;
        dependencies.trackEvent(
          "chat_message_interrupted",
          { session_message_count: session.messageCount },
          session.accountId,
        );
        throw error;
      } finally {
        session.inFlight = false;
      }
    })();
  });

  return router;
};

export default createChatRouter();
