import { type Context, Router } from "../deps.ts";
import {
  generateChatStream,
  isProviderAvailable,
  resolveAvailableModel,
} from "../services/aiService.ts";
import { billingService } from "../services/billingService.ts";
import logger from "../services/logger.ts";
import { track } from "../services/telemetry.ts";
import {
  getWingAuth,
  requireWingSession,
} from "../middlewares/authMiddleware.ts";
import {
  estimateChatCharge,
  estimateTokens,
  resolveBillableModel,
} from "../services/creditUsage.ts";
import {
  isQualityLevelAllowedForPlan,
  isSelectableQualityLevel,
  resolveQualityLevelModel,
} from "../services/qualityLevels.ts";
import {
  compactHistory,
  DEFAULT_CONTEXT_WINDOW_ENTRIES,
} from "../services/chatContextCache.ts";
import { geminiContextCache } from "../services/geminiContextCache.ts";
import {
  type AppSessionService,
  appSessionService,
} from "../services/appSessionService.ts";

// ChatHistoryEntry is imported from cache domain

interface ChatSession {
  accountId: string;
  // M4.6: vem do appSessionId validado no /start, nunca de um campo enviado
  // pelo cliente — assim a sessão de chat nunca pode se anexar a uma
  // instância/documento diferente daquela em que foi criada.
  appSessionId: string;
  documentId: string;
  createdAt: number;
  expiresAt: number;
  // Separado do histórico conversacional (M4.5): é o prefixo estável
  // (instruções + documento) que vira `systemInstruction`/cache de prompt
  // no provedor, em vez de ocupar as duas primeiras entradas de `history`
  // repetidas a cada turno.
  documentText: string;
  history: ChatHistoryEntry[];
  inFlight: boolean;
  messageCount: number;
  timeoutId: number;
}

const buildDocumentSystemInstruction = (documentText: string): string =>
  `Você é um assistente especialista neste documento. Analise o conteúdo a seguir e responda perguntas sobre ele. O documento é:\n\n---\n${documentText}\n---`;

export interface ChatLimits {
  maxDocumentChars: number;
  maxMessageChars: number;
  maxMessages: number;
  sessionTtlMs: number;
}

export interface ChatRouteDependencies {
  generateStream: typeof generateChatStream;
  getEntitlement: typeof billingService.getEntitlement;
  reserveCredits: typeof billingService.reserveCredits;
  settleCredits: typeof billingService.settleCredits;
  isAccountRevoked: typeof billingService.isAccountRevoked;
  now: () => number;
  randomUUID: () => string;
  scheduleExpiration: (callback: () => void, delay: number) => number;
  cancelExpiration: (timeoutId: number) => void;
  trackEvent: typeof track;
  getCachedContent: typeof geminiContextCache.getOrCreate;
  appSessions: Pick<AppSessionService, "validate">;
  isProviderAvailable: typeof isProviderAvailable;
  isProduction: boolean;
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(Deno.env.get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const defaultLimits: ChatLimits = {
  maxDocumentChars: positiveInteger("WING_CHAT_MAX_DOCUMENT_CHARS", 120_000),
  maxMessageChars: positiveInteger("WING_CHAT_MAX_MESSAGE_CHARS", 4_000),
  maxMessages: positiveInteger("WING_CHAT_MAX_MESSAGES", 30),
  sessionTtlMs: positiveInteger("WING_CHAT_SESSION_TTL_MS", 30 * 60 * 1000),
};

const defaultDependencies: ChatRouteDependencies = {
  generateStream: generateChatStream,
  getEntitlement: billingService.getEntitlement,
  reserveCredits: billingService.reserveCredits,
  settleCredits: billingService.settleCredits,
  isAccountRevoked: billingService.isAccountRevoked,
  now: Date.now,
  randomUUID: () => crypto.randomUUID(),
  scheduleExpiration: (callback, delay) => {
    const timeoutId = setTimeout(callback, delay);
    Deno.unrefTimer(timeoutId);
    return timeoutId;
  },
  cancelExpiration: (timeoutId) => clearTimeout(timeoutId),
  trackEvent: track,
  getCachedContent: geminiContextCache.getOrCreate,
  appSessions: appSessionService,
  isProviderAvailable,
  isProduction: Deno.env.get("NODE_ENV") === "production",
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

import {
  ChatConfig,
  ChatUseCases,
} from "../contexts/chat/application/use-cases/ChatUseCases.ts";
import { InMemoryChatSessionRepository } from "../contexts/chat/infrastructure/adapters/InMemoryChatSessionRepository.ts";
import { ChatHistoryEntry } from "../contexts/cache/domain/ChatHistoryCompactor.ts";
import {
  AccountRevokedError,
  AppSessionExpiredError,
  ChatDocumentTooLargeError,
  ChatMessageInProgressError,
  ChatMessageLimitError,
  ChatMessageTooLargeError,
  ChatSessionNotFoundError,
  ModelProviderUnavailableError,
  QualityLevelRequiresUpgradeError,
  QuotaExceededError,
} from "../contexts/chat/application/errors.ts";

const defaultConfig: ChatConfig = {
  contextWindowEntries: positiveInteger(
    "WING_CHAT_CONTEXT_WINDOW",
    DEFAULT_CONTEXT_WINDOW_ENTRIES,
  ),
  promptCacheTtlSeconds: positiveInteger(
    "WING_CHAT_PROMPT_CACHE_TTL_SECONDS",
    3_600,
  ),
  freeMonthlyCreditLimit: positiveInteger("WING_FREE_MONTHLY_CREDITS", 1_000),
  maxOutputTokens: positiveInteger("WING_CHAT_MAX_OUTPUT_TOKENS", 2_048),
  defaultBillableModel: resolveBillableModel(Deno.env.get("GEMINI_MODEL")),
};

export type { ChatConfig };

export const createChatRouter = (
  dependencies: ChatRouteDependencies = defaultDependencies,
  limits: ChatLimits = defaultLimits,
  config: ChatConfig = defaultConfig,
) => {
  const router = new Router();
  const repository = new InMemoryChatSessionRepository(
    dependencies.scheduleExpiration,
    dependencies.cancelExpiration,
  );
  const useCases = new ChatUseCases(
    repository,
    {
      now: dependencies.now,
      randomUUID: dependencies.randomUUID,
      isAccountRevoked: dependencies.isAccountRevoked,
      validateAppSession: (appSessionId, accountId) => {
        const session = dependencies.appSessions.validate(
          appSessionId,
          accountId,
        );
        return session
          ? {
            appSessionId: session.appSessionId,
            documentId: session.documentId,
            absoluteExpiresAt: session.absoluteExpiresAt,
          }
          : null;
      },
      getEntitlement: dependencies.getEntitlement,
      reserveCredits: dependencies.reserveCredits,
      settleCredits: async (reservationId, charge) => {
        await dependencies.settleCredits(reservationId, charge);
      },
      trackEvent: dependencies.trackEvent,
      getCachedContent: dependencies.getCachedContent,
      generateStream: dependencies.generateStream,
      estimateChatCharge,
      estimateTokens,
      isSelectableQualityLevel,
      isQualityLevelAllowedForPlan,
      resolveQualityLevelModel: (level) => {
        const resolvedModel = resolveQualityLevelModel(level);
        const model = resolveAvailableModel(
          resolvedModel,
          config.defaultBillableModel,
          dependencies.isProduction,
          dependencies.isProviderAvailable,
        );
        if (model !== resolvedModel) {
          logger.warn(
            `[chat] Modelo '${resolvedModel}' sem API key em desenvolvimento; usando '${model}' como fallback.`,
          );
        }
        return model;
      },
      isModelAvailable: dependencies.isProviderAvailable,
    },
    limits,
    config,
  );

  router.use(requireWingSession);

  router.post("/start", async (ctx) => {
    const body = await readJson(ctx);
    if (!body) return;

    const { documentText, priorMessages } = body;
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
    const appSessionId = ctx.request.headers.get("X-Wing-App-Session");
    if (!isNonEmptyString(appSessionId)) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Sessão de instância do Word ausente.",
        code: "app_session_required",
      };
      return;
    }

    try {
      const { sessionId, expiresAt } = await useCases.startSession(
        auth.accountId,
        appSessionId,
        documentText,
        priorMessages,
      );

      ctx.response.status = 201;
      ctx.response.body = { sessionId, expiresAt };
    } catch (error) {
      if (error instanceof ChatDocumentTooLargeError) {
        ctx.response.status = 413;
        ctx.response.body = {
          error: `O documento excede o limite de ${error.limit} caracteres.`,
          code: "chat_document_too_large",
        };
      } else if (error instanceof AccountRevokedError) {
        ctx.response.status = 403;
        ctx.response.body = {
          error: "Esta conta está revogada.",
          code: "account_revoked",
        };
      } else if (error instanceof AppSessionExpiredError) {
        ctx.response.status = 403;
        ctx.response.body = {
          error: "Sessão de instância do Word inválida ou expirada.",
          code: "app_session_expired",
        };
      } else {
        throw error;
      }
    }
  });

  interface SendMessageRequest {
    sessionId: string;
    message: string;
    qualityLevel: unknown;
  }

  router.post("/message", async (ctx) => {
    const body = await readJson(ctx);
    if (!body) return;

    const { sessionId, message, qualityLevel } = body as Partial<
      SendMessageRequest
    >;
    if (!isNonEmptyString(sessionId) || !isNonEmptyString(message)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "sessionId e message são obrigatórios." };
      return;
    }

    const auth = getWingAuth(ctx);

    try {
      const stream = await useCases.sendMessage(
        auth.accountId,
        sessionId,
        message,
        qualityLevel,
      );
      ctx.response.status = 200;
      ctx.response.body = stream;
    } catch (error) {
      if (error instanceof ChatMessageTooLargeError) {
        ctx.response.status = 413;
        ctx.response.body = {
          error: `A mensagem excede o limite de ${error.limit} caracteres.`,
          code: "chat_message_too_large",
        };
      } else if (error instanceof ChatSessionNotFoundError) {
        ctx.response.status = 404;
        ctx.response.body = {
          error: "Sessão de chat não encontrada ou expirada.",
        };
      } else if (error instanceof AppSessionExpiredError) {
        ctx.response.status = 403;
        ctx.response.body = {
          error: "Sessão de instância do Word expirada.",
          code: "app_session_expired",
        };
      } else if (error instanceof ChatMessageInProgressError) {
        ctx.response.status = 409;
        ctx.response.body = {
          error: "Aguarde a resposta atual antes de enviar outra mensagem.",
          code: "chat_message_in_progress",
        };
      } else if (error instanceof ChatMessageLimitError) {
        ctx.response.status = 429;
        ctx.response.body = {
          error: "Limite de mensagens desta sessão atingido.",
          code: "chat_message_limit",
        };
      } else if (error instanceof AccountRevokedError) {
        ctx.response.status = 403;
        ctx.response.body = {
          error: "Esta conta está revogada.",
          code: "account_revoked",
        };
      } else if (error instanceof QualityLevelRequiresUpgradeError) {
        ctx.response.status = 402;
        ctx.response.body = {
          error: "O nível Profundo requer o Wing Pro. Assine para usá-lo.",
          code: "quality_level_requires_upgrade",
        };
      } else if (error instanceof QuotaExceededError) {
        ctx.response.status = 402;
        ctx.response.body = {
          error:
            "Limite mensal do plano Free atingido. Assine o Wing Pro para continuar.",
          code: "quota_exceeded",
        };
      } else if (error instanceof ModelProviderUnavailableError) {
        logger.error(
          `[chat] Provedor '${error.provider}' indisponível para o modelo '${error.model}'. Verifique a API key correspondente.`,
        );
        ctx.response.status = 503;
        ctx.response.body = {
          error: "O modelo selecionado está temporariamente indisponível.",
          code: "model_provider_unavailable",
          provider: error.provider,
          model: error.model,
        };
      } else {
        throw error;
      }
    }
  });

  return router;
};

export default createChatRouter();
