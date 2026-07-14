import { type Context, Router } from "../deps.ts";
import { generateChatStream } from "../services/aiService.ts";
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
import { compactHistory, DEFAULT_CONTEXT_WINDOW_ENTRIES } from "../services/chatContextCache.ts";
import { geminiContextCache } from "../services/geminiContextCache.ts";

export interface ChatHistoryEntry {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

interface ChatSession {
  accountId: string;
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
  maxSessionsPerAccount: number;
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
  reserveCredits: billingService.reserveCredits,
  settleCredits: billingService.settleCredits,
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
  getCachedContent: geminiContextCache.getOrCreate,
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

// M4.5: reabrir o painel restaura a conversa no cliente (localStorage), mas
// a sessão de backend em si é efêmera — reconectar sem isto perdia todo o
// contexto de perguntas anteriores. Aceita um histórico prévio (opcional,
// vindo do cache local do cliente), mas sempre compacta pro mesmo limite de
// janela usado durante a conversa — nunca "reenvia histórico ilimitado"
// (gate de saída do M4.5), mesmo que o cliente mande uma conversa longa.
const MAX_PRIOR_MESSAGES_ACCEPTED = 200;

const sanitizePriorMessages = (
  value: unknown,
  maxMessageChars: number,
): ChatHistoryEntry[] => {
  if (!Array.isArray(value)) return [];

  const sanitized: ChatHistoryEntry[] = [];
  for (const raw of value.slice(0, MAX_PRIOR_MESSAGES_ACCEPTED)) {
    if (typeof raw !== "object" || raw === null) continue;
    const role = (raw as { role?: unknown }).role;
    const text = (raw as { parts?: Array<{ text?: unknown }> }).parts?.[0]?.text;
    if (role !== "user" && role !== "model") continue;
    if (typeof text !== "string" || text.trim().length === 0) continue;
    sanitized.push({ role, parts: [{ text: text.slice(0, maxMessageChars) }] });
  }
  return sanitized;
};

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

    // Reconstrói o contexto de uma conversa restaurada (cache local do
    // cliente) sem "reenviar histórico ilimitado" — sempre compactado pra
    // janela padrão, mesmo se o cliente mandar uma conversa longa.
    const contextWindowEntries = positiveInteger(
      "WING_CHAT_CONTEXT_WINDOW",
      DEFAULT_CONTEXT_WINDOW_ENTRIES,
    );
    const seededHistory = compactHistory(
      sanitizePriorMessages(priorMessages, limits.maxMessageChars),
      contextWindowEntries,
    );

    const now = dependencies.now();
    const sessionId = dependencies.randomUUID();
    const timeoutId = dependencies.scheduleExpiration(() => {
      sessions.delete(sessionId);
    }, limits.sessionTtlMs);
    sessions.set(sessionId, {
      accountId: auth.accountId,
      createdAt: now,
      expiresAt: now + limits.sessionTtlMs,
      documentText,
      history: seededHistory,
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

    const { sessionId, message, qualityLevel } = body;
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
    let reservationId = "";
    let maxOutputTokens = 0;
    let billableModel = resolveBillableModel(Deno.env.get("GEMINI_MODEL"));
    const historyBeforeMessage = session.history.slice();
    // M4.5: só os últimos N turnos brutos + um resumo compacto do resto vão
    // pro provedor — sem isso, cada mensagem reenviava a conversa inteira,
    // inflando custo/latência sem contexto proporcional. A cobrança usa o
    // MESMO histórico compactado que é enviado de fato (senão a reserva de
    // crédito cobraria por um contexto maior do que o realmente transmitido).
    const contextWindowEntries = positiveInteger(
      "WING_CHAT_CONTEXT_WINDOW",
      DEFAULT_CONTEXT_WINDOW_ENTRIES,
    );
    const compactedHistory = compactHistory(historyBeforeMessage, contextWindowEntries);
    const systemInstruction = buildDocumentSystemInstruction(session.documentText);
    let cachedContentName: string | undefined;
    let enablePromptCache = false;
    let promptCacheAttempted = false;
    let promptCacheProvider: "gemini" | "openai" | "anthropic" | undefined;
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

      // Chat também aceita nível de qualidade (QUICK_MODEL_ROUTING_PLAN
      // Entrega 2: "reescrita e chat aceitam rápido, equilibrado e
      // profundo"). Mesma autorização por plano do rewrite: ter créditos
      // não basta pra "profundo", exige plano pago. Bloqueia ANTES de
      // reservar crédito ou chamar a IA.
      if (
        isSelectableQualityLevel(qualityLevel) &&
        !isQualityLevelAllowedForPlan(qualityLevel, entitlement.plan)
      ) {
        ctx.response.status = 402;
        ctx.response.body = {
          error: "O nível Profundo requer o Wing Pro. Assine para usá-lo.",
          code: "quality_level_requires_upgrade",
        };
        session.inFlight = false;
        return;
      }
      billableModel = resolveQualityLevelModel(qualityLevel);

      // M4.5: cache de prompt no provedor pro prefixo estável (documento).
      // Os níveis de qualidade selecionáveis hoje resolvem sempre pra
      // GPT/Claude (nunca Gemini) — por isso o cache precisa cobrir os três
      // mecanismos, não só o do Gemini (que ficaria morto/inalcançável via
      // chat). Gemini usa cache explícito (GoogleAICacheManager, precisa
      // criar/referenciar por nome); OpenAI e Anthropic cacheiam de forma
      // implícita no próprio provedor — só pedimos pra habilitar e o hit
      // real só é conhecido depois que o stream inteiro é consumido (por
      // isso a telemetria é registrada só depois, não aqui).
      if (billableModel.startsWith("gemini")) {
        promptCacheAttempted = true;
        promptCacheProvider = "gemini";
        const cacheEntry = await dependencies.getCachedContent({
          accountId: auth.accountId,
          documentText: session.documentText,
          model: billableModel,
          systemInstruction,
          ttlSeconds: positiveInteger("WING_CHAT_PROMPT_CACHE_TTL_SECONDS", 3_600),
        }).catch((error) => {
          logger.error({ err: error }, "Falha ao obter cache de prompt do chat.");
          return null;
        });
        cachedContentName = cacheEntry?.name;
      } else if (billableModel.startsWith("claude")) {
        promptCacheAttempted = true;
        promptCacheProvider = "anthropic";
        enablePromptCache = true;
      } else if (billableModel.startsWith("gpt")) {
        promptCacheAttempted = true;
        promptCacheProvider = "openai";
        enablePromptCache = true;
      }

      const freeMonthlyLimit = positiveInteger(
        "WING_FREE_MONTHLY_CREDITS",
        1_000,
      );
      maxOutputTokens = positiveInteger(
        "WING_CHAT_MAX_OUTPUT_TOKENS",
        2_048,
      );
      const reservedCharge = estimateChatCharge(
        message,
        [{ parts: [{ text: systemInstruction }] }, ...compactedHistory],
        billableModel,
        maxOutputTokens,
      );
      const usageLimit = entitlement.plan === "free" ? freeMonthlyLimit : null;
      const usage = await dependencies.reserveCredits(
        auth.accountId,
        billableModel,
        reservedCharge.credits,
        usageLimit,
      );
      reservationId = usage.reservationId;
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
    let stream: ReturnType<typeof dependencies.generateStream>;
    try {
      stream = dependencies.generateStream(
        trimmedMessage,
        compactedHistory,
        // `model: billableModel` é o que garante que o modelo executado é o
        // mesmo que foi reservado/cobrado acima — sem isso, a reserva de
        // crédito usa o nível escolhido mas a chamada de IA de fato caía
        // sempre no provedor padrão (Gemini), desalinhando execução e
        // cobrança quando o nível resolvia pra outro provedor.
        {
          entitlement: entitlement.plan,
          maxOutputTokens,
          model: billableModel,
          systemInstruction,
          cachedContentName,
          enablePromptCache,
        },
      );
    } catch (error) {
      await dependencies.settleCredits(reservationId, {
        credits: 0,
        inputTokens: 0,
        outputTokens: 0,
      }).catch(
        (settlementError) =>
          logger.error(
            { err: settlementError },
            "Falha ao liberar reserva do chat.",
          ),
      );
      session.inFlight = false;
      throw error;
    }
    session.history.push({ role: "user", parts: [{ text: trimmedMessage }] });

    ctx.response.status = 200;
    ctx.response.body = (async function* () {
      let completeResponse = "";
      try {
        // Iteração manual (não `for await...of`) pra capturar o valor de
        // `return` do generator — é só ali, depois do stream inteiro
        // consumido, que dá pra saber quantos tokens do prefixo vieram do
        // cache de verdade (não apenas "um cache existe/foi criado").
        let cachedTokens = 0;
        let next = await stream.next();
        while (!next.done) {
          completeResponse += next.value;
          yield next.value;
          next = await stream.next();
        }
        cachedTokens = typeof next.value === "number" ? next.value : 0;

        if (promptCacheAttempted && promptCacheProvider) {
          dependencies.trackEvent(
            "chat_context_cache_used",
            {
              cached: cachedTokens > 0 ? 1 : 0,
              cached_tokens: cachedTokens,
              provider: promptCacheProvider,
            },
            session.accountId,
          );
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
        if (reservationId) {
          // Mesma base da reserva (systemInstruction + histórico compactado)
          // — senão a liquidação "true-up" comparado a uma estimativa de
          // entrada diferente da que foi de fato reservada/enviada.
          const actualCharge = estimateChatCharge(
            trimmedMessage,
            [{ parts: [{ text: systemInstruction }] }, ...compactedHistory],
            billableModel,
            estimateTokens(completeResponse),
          );
          await dependencies.settleCredits(
            reservationId,
            actualCharge,
          ).catch((error) => {
            logger.error({ err: error }, "Falha ao liquidar consumo do chat.");
          });
        }
        session.inFlight = false;
      }
    })();
  });

  return router;
};

export default createChatRouter();
