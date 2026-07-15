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
import {
  type AppSessionService,
  appSessionService,
} from "../services/appSessionService.ts";

export interface ChatHistoryEntry {
  role: "user" | "model";
  parts: Array<{ text: string }>;
}

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
  randomUUID: crypto.randomUUID,
  scheduleExpiration: (callback, delay) => {
    const timeoutId = setTimeout(callback, delay);
    Deno.unrefTimer(timeoutId);
    return timeoutId;
  },
  cancelExpiration: clearTimeout,
  trackEvent: track,
  getCachedContent: geminiContextCache.getOrCreate,
  appSessions: appSessionService,
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
    // M4.6: appSessionId identifica a instância aberta do Word (independente
    // do login) — a sessão de chat herda dele o vínculo com o documento, em
    // vez de aceitar um documentId enviado solto pelo cliente. Sem cap por
    // conta: qualquer quantidade de instâncias é permitida, só o saldo de
    // créditos limita.
    const appSessionId = ctx.request.headers.get("X-Wing-App-Session");
    if (!isNonEmptyString(appSessionId)) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Sessão de instância do Word ausente.",
        code: "app_session_required",
      };
      return;
    }
    const appSession = dependencies.appSessions.validate(
      appSessionId,
      auth.accountId,
    );
    if (!appSession) {
      ctx.response.status = 403;
      ctx.response.body = {
        error: "Sessão de instância do Word inválida ou expirada.",
        code: "app_session_expired",
      };
      return;
    }

    const entitlement = await dependencies.getEntitlement(auth.accountId);
    removeExpiredSessions();

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
      appSessionId: appSession.appSessionId,
      documentId: appSession.documentId,
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
    // M4.6: revalida a cada mensagem, não só no /start — sem isto, fechar a
    // instância do Word só cortaria o chat quando o TTL de 30 min do chat em
    // si vencesse, um prazo muito mais longo e desacoplado do fechamento.
    const appSession = dependencies.appSessions.validate(session.appSessionId, auth.accountId);
    if (!appSession) {
      ctx.response.status = 403;
      ctx.response.body = {
        error: "Sessão de instância do Word expirada.",
        code: "app_session_expired",
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
        // M4.7: nunca cacheia por mais tempo do que a app session ainda vai
        // viver — sem isso, um cache criado a poucos minutos do teto
        // absoluto (1h) continuava sendo cobrado pelo TTL cheio configurado
        // mesmo depois da sessão dona dele ter encerrado (o `onSessionEnd`
        // em appSessionService.ts cobre o encerramento, mas não uma
        // criação tardia cujo TTL nominal já nasce maior que o tempo de
        // vida restante da sessão).
        const configuredTtlSeconds = positiveInteger(
          "WING_CHAT_PROMPT_CACHE_TTL_SECONDS",
          3_600,
        );
        const remainingSessionSeconds = Math.max(
          1,
          Math.floor((appSession.absoluteExpiresAt - dependencies.now()) / 1000),
        );
        const cacheEntry = await dependencies.getCachedContent({
          accountId: auth.accountId,
          documentText: session.documentText,
          model: billableModel,
          systemInstruction,
          ttlSeconds: Math.min(configuredTtlSeconds, remainingSessionSeconds),
          // M4.6: isola o cache remoto por instância — duas app sessions no
          // mesmo documento não compartilham o mesmo cache de prompt.
          appSessionId: session.appSessionId,
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
      // Declarado fora do `try` de propósito: a liquidação no `finally`
      // precisa da repartição real de cache mesmo quando o try já terminou
      // (sucesso ou erro) — sem isso, a cobrança final nunca sabia se houve
      // cache hit de verdade, e reconciliava só pela saída, ignorando a
      // economia real de entrada.
      let cacheUsage: {
        cachedInputTokens: number;
        cacheWriteTokens: number;
        totalInputTokens?: number;
      } = {
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
      };
      try {
        // Iteração manual (não `for await...of`) pra capturar o valor de
        // `return` do generator — é só ali, depois do stream inteiro
        // consumido, que dá pra saber a repartição real de tokens de cache
        // (não apenas "um cache existe/foi criado").
        let next = await stream.next();
        while (!next.done) {
          completeResponse += next.value;
          yield next.value;
          next = await stream.next();
        }
        if (next.value) cacheUsage = next.value;

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
          // entrada diferente da que foi de fato reservada/enviada. Agora
          // com a repartição real de cache: reconcilia a cobrança estimada
          // (sempre tarifa cheia, conservadora) com o consumo real
          // reportado pelo provedor (M4.7).
          const actualCharge = estimateChatCharge(
            trimmedMessage,
            [{ parts: [{ text: systemInstruction }] }, ...compactedHistory],
            billableModel,
            estimateTokens(completeResponse),
            cacheUsage,
          );

          // Telemetria de cache registrada aqui (não antes) pra reusar a
          // MESMA cobrança calculada acima — inclui `credits_saved`, a
          // prova final de "economia visível ao cliente" que o gate do
          // M4.7 pede, não só uma contagem de tokens.
          if (promptCacheAttempted && promptCacheProvider) {
            const totalCacheTokens = cacheUsage.cachedInputTokens + cacheUsage.cacheWriteTokens;
            dependencies.trackEvent(
              "chat_context_cache_used",
              {
                cached: cacheUsage.cachedInputTokens > 0 ? 1 : 0,
                cached_tokens: totalCacheTokens,
                provider: promptCacheProvider,
                credits_saved: actualCharge.creditsSaved,
              },
              session.accountId,
            );
          }

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
