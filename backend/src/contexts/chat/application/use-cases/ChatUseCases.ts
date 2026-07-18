import { ChatLimits, ChatSession } from "../../domain/ChatSession.ts";
import { ChatSessionRepository } from "../ports/out/ChatSessionRepository.ts";
import {
  ChatHistoryEntry,
  compactHistory,
} from "../../../cache/domain/ChatHistoryCompactor.ts";
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
} from "../errors.ts";

export interface CreditCharge {
  credits: number;
  inputTokens: number;
  outputTokens: number;
  creditsSaved?: number;
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
}

// Uso de cache devolvido pelo provedor de IA ao final do stream — declarado
// aqui (em vez de importado de src/providers/) pra não acoplar a aplicação
// a um módulo de infraestrutura concreto.
export interface ProviderCacheUsage {
  cachedInputTokens: number;
  cacheWriteTokens: number;
  totalInputTokens?: number;
}

export interface GenerateStreamOptions {
  entitlement: string;
  maxOutputTokens: number;
  model: string;
  systemInstruction: string;
  cachedContentName?: string;
  enablePromptCache: boolean;
}

export interface CachedContentParams {
  accountId: string;
  documentText: string;
  model: string;
  systemInstruction: string;
  ttlSeconds: number;
  appSessionId: string;
}

export interface CachedContentResult {
  name: string;
}

export interface ValidatedAppSession {
  appSessionId: string;
  documentId: string;
  absoluteExpiresAt: number;
}

// Configuração numérica que antes era lida de variáveis de ambiente dentro
// do caso de uso — a leitura de ENV pertence ao composition root
// (chat.routes.ts), não à camada de aplicação.
export interface ChatConfig {
  contextWindowEntries: number;
  promptCacheTtlSeconds: number;
  // "free" é o teste grátis: concessão única (não mensal — ver migration
  // 20260717120000_add_trial_credits.sql). Planos pagos usam
  // monthlyCreditLimits, com teto próprio por tier (ausente = ilimitado,
  // caso de team/enterprise até M7 definir preço B2B).
  trialCreditLimit: number;
  trialDurationSeconds: number;
  monthlyCreditLimits: Partial<Record<string, number>>;
  maxOutputTokens: number;
  defaultBillableModel: string;
}

// Ports needed by the use case — inclui as regras de tarifação e de nível
// de qualidade (antes importadas diretamente de services/creditUsage.ts e
// services/qualityLevels.ts), agora injetadas pelo composition root.
export interface ChatDependencies {
  now(): number;
  randomUUID(): string;
  isAccountRevoked(accountId: string): Promise<boolean>;
  validateAppSession(
    appSessionId: string,
    accountId: string,
  ): ValidatedAppSession | null;
  getEntitlement(accountId: string): Promise<{ plan: string }>;
  reserveCredits(
    accountId: string,
    model: string,
    credits: number,
    limit: number | null,
  ): Promise<{ reservationId: string; allowed: boolean }>;
  settleCredits(
    reservationId: string,
    charge: { credits: number; inputTokens: number; outputTokens: number },
  ): Promise<void>;
  reserveTrialCredits(
    accountId: string,
    model: string,
    credits: number,
    limit: number,
    trialDurationSeconds: number,
  ): Promise<{
    reservationId: string;
    allowed: boolean;
    trialExpired: boolean;
    waitlisted?: boolean;
  }>;
  settleTrialCredits(
    reservationId: string,
    charge: { credits: number; inputTokens: number; outputTokens: number },
  ): Promise<void>;
  trackEvent(
    eventName: string,
    properties: Record<string, unknown> | undefined,
    accountId: string,
  ): void;
  getCachedContent(
    params: CachedContentParams,
  ): Promise<CachedContentResult | null>;
  generateStream(
    prompt: string,
    history: ChatHistoryEntry[],
    options: GenerateStreamOptions,
  ): AsyncGenerator<string, ProviderCacheUsage | void, unknown>;
  estimateChatCharge(
    message: string,
    history: Array<{ parts?: Array<{ text?: string }> }>,
    model: string,
    outputTokens: number,
    cacheUsage?: {
      cachedInputTokens?: number;
      cacheWriteTokens?: number;
      totalInputTokens?: number;
    },
  ): CreditCharge;
  estimateTokens(text: string): number;
  isSelectableQualityLevel(value: unknown): boolean;
  isQualityLevelAllowedForPlan(level: unknown, plan: string): boolean;
  resolveQualityLevelModel(level: unknown): string;
  isModelAvailable(model: string): boolean;
}

const providerForModel = (model: string): string => {
  if (model.startsWith("gpt")) return "openai";
  if (model.startsWith("claude")) return "anthropic";
  return "gemini";
};

const buildDocumentSystemInstruction = (documentText: string): string =>
  `Você é um assistente especialista neste documento. Analise o conteúdo a seguir e responda perguntas sobre ele. O documento é:\n\n---\n${documentText}\n---`;

interface SanitizedHistoryEntry {
  role: unknown;
  parts?: Array<{ text?: unknown }>;
}

export class ChatUseCases {
  constructor(
    private readonly repository: ChatSessionRepository,
    private readonly deps: ChatDependencies,
    private readonly limits: ChatLimits,
    private readonly config: ChatConfig,
  ) {}

  async startSession(
    accountId: string,
    appSessionId: string,
    documentText: string,
    priorMessages: unknown,
  ): Promise<{ sessionId: string; expiresAt: string }> {
    if (documentText.length > this.limits.maxDocumentChars) {
      throw new ChatDocumentTooLargeError(this.limits.maxDocumentChars);
    }

    if (await this.deps.isAccountRevoked(accountId)) {
      throw new AccountRevokedError();
    }

    const appSession = this.deps.validateAppSession(appSessionId, accountId);
    if (!appSession) {
      throw new AppSessionExpiredError();
    }

    const entitlement = await this.deps.getEntitlement(accountId);
    this.repository.removeExpired(this.deps.now());

    // Sanitize prior messages locally
    const sanitizePriorMessages = (
      value: unknown,
      maxMessageChars: number,
    ): ChatHistoryEntry[] => {
      if (!Array.isArray(value)) return [];
      const sanitized: ChatHistoryEntry[] = [];
      for (const raw of value.slice(0, 200) as unknown[]) {
        if (typeof raw !== "object" || raw === null) continue;
        const { role, parts } = raw as SanitizedHistoryEntry;
        const text = parts?.[0]?.text;
        if (role !== "user" && role !== "model") continue;
        if (typeof text !== "string" || text.trim().length === 0) continue;
        sanitized.push({
          role,
          parts: [{ text: text.slice(0, maxMessageChars) }],
        });
      }
      return sanitized;
    };

    const seededHistory = compactHistory(
      sanitizePriorMessages(priorMessages, this.limits.maxMessageChars),
      this.config.contextWindowEntries,
    );

    const now = this.deps.now();
    const sessionId = this.deps.randomUUID();

    const session = new ChatSession(
      sessionId,
      accountId,
      appSession.appSessionId,
      appSession.documentId,
      documentText,
      now,
      now + this.limits.sessionTtlMs,
      seededHistory,
    );

    this.repository.save(session);
    this.repository.scheduleExpiration(
      sessionId,
      this.limits.sessionTtlMs,
      () => {
        // Expiration handled by repository wrapper
      },
    );

    this.deps.trackEvent(
      "chat_session_started",
      { entitlement: entitlement.plan, document_chars: documentText.length },
      accountId,
    );

    return {
      sessionId,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  }

  async sendMessage(
    accountId: string,
    sessionId: string,
    message: string,
    qualityLevel: unknown,
  ): Promise<AsyncGenerator<string, void, unknown>> {
    if (message.length > this.limits.maxMessageChars) {
      throw new ChatMessageTooLargeError(this.limits.maxMessageChars);
    }

    const session = this.repository.get(sessionId);
    if (
      !session || session.accountId !== accountId ||
      session.isExpired(this.deps.now())
    ) {
      if (session?.isExpired(this.deps.now())) {
        this.repository.delete(sessionId);
      }
      throw new ChatSessionNotFoundError();
    }

    // Revalida a App Session (instância do Word) a cada mensagem — nunca
    // confia em um TTL calculado no /start, já que a instância pode
    // encerrar no meio da conversa. absoluteExpiresAt sai dessa mesma
    // validação (não é mais responsabilidade da rota calcular).
    const appSession = this.deps.validateAppSession(
      session.appSessionId,
      accountId,
    );
    if (!appSession) {
      throw new AppSessionExpiredError();
    }

    if (!session.canAcceptMessage(this.limits.maxMessages)) {
      if (session.inFlight) throw new ChatMessageInProgressError();
      throw new ChatMessageLimitError();
    }

    session.inFlight = true;
    let reservationId = "";
    let isTrial = false;
    let billableModel = this.config.defaultBillableModel;
    const historyBeforeMessage = session.history.slice();
    const systemInstruction = buildDocumentSystemInstruction(
      session.documentText,
    );
    const compactedHistory = compactHistory(
      historyBeforeMessage,
      this.config.contextWindowEntries,
    );

    let cachedContentName: string | undefined;
    let enablePromptCache = false;
    let promptCacheAttempted = false;
    let promptCacheProvider: string | undefined;
    let entitlementPlan = "free";

    // Telemetria: duração total + breakdown por fase (M5). requestStartedAt
    // cobre a chamada inteira; cada fase mede só o próprio trecho async —
    // cache_lookup_ms fica de fora do objeto quando a fase nem roda (só
    // Gemini tenta cache), em vez de aparecer como 0 e sugerir que rodou.
    const requestStartedAt = this.deps.now();
    let entitlementMs = 0;
    let cacheLookupMs = 0;
    let creditReserveMs = 0;

    try {
      const entitlementStartedAt = this.deps.now();
      if (await this.deps.isAccountRevoked(accountId)) {
        throw new AccountRevokedError();
      }

      const entitlement = await this.deps.getEntitlement(accountId);
      entitlementMs = this.deps.now() - entitlementStartedAt;
      entitlementPlan = entitlement.plan;

      if (
        this.deps.isSelectableQualityLevel(qualityLevel) &&
        !this.deps.isQualityLevelAllowedForPlan(qualityLevel, entitlement.plan)
      ) {
        throw new QualityLevelRequiresUpgradeError();
      }
      billableModel = this.deps.resolveQualityLevelModel(qualityLevel);

      if (!this.deps.isModelAvailable(billableModel)) {
        throw new ModelProviderUnavailableError(
          billableModel,
          providerForModel(billableModel),
        );
      }

      if (billableModel.startsWith("gemini")) {
        promptCacheAttempted = true;
        promptCacheProvider = "gemini";
        const remainingSessionSeconds = Math.max(
          1,
          Math.floor((appSession.absoluteExpiresAt - this.deps.now()) / 1000),
        );
        const cacheLookupStartedAt = this.deps.now();
        const cacheEntry = await this.deps.getCachedContent({
          accountId,
          documentText: session.documentText,
          model: billableModel,
          systemInstruction,
          ttlSeconds: Math.min(
            this.config.promptCacheTtlSeconds,
            remainingSessionSeconds,
          ),
          appSessionId: session.appSessionId,
        }).catch(() => null);
        cacheLookupMs = this.deps.now() - cacheLookupStartedAt;
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

      const reservedCharge = this.deps.estimateChatCharge(
        message,
        [{ parts: [{ text: systemInstruction }] }, ...compactedHistory],
        billableModel,
        this.config.maxOutputTokens,
      );

      isTrial = entitlement.plan === "free";
      const creditReserveStartedAt = this.deps.now();
      const usage = isTrial
        ? await this.deps.reserveTrialCredits(
          accountId,
          billableModel,
          reservedCharge.credits,
          this.config.trialCreditLimit,
          this.config.trialDurationSeconds,
        )
        : await this.deps.reserveCredits(
          accountId,
          billableModel,
          reservedCharge.credits,
          this.config.monthlyCreditLimits[entitlement.plan] ?? null,
        );
      creditReserveMs = this.deps.now() - creditReserveStartedAt;
      reservationId = usage.reservationId;

      if (!usage.allowed) {
        throw new QuotaExceededError(
          isTrial &&
            Boolean((usage as { trialExpired?: boolean }).trialExpired),
          isTrial && Boolean((usage as { waitlisted?: boolean }).waitlisted),
        );
      }
    } catch (error) {
      session.inFlight = false;
      throw error;
    }

    const trimmedMessage = message.trim();
    let stream: ReturnType<typeof this.deps.generateStream>;

    try {
      stream = this.deps.generateStream(
        trimmedMessage,
        compactedHistory,
        {
          entitlement: entitlementPlan,
          maxOutputTokens: this.config.maxOutputTokens,
          model: billableModel,
          systemInstruction,
          cachedContentName,
          enablePromptCache,
        },
      );
    } catch (error) {
      await (isTrial ? this.deps.settleTrialCredits : this.deps.settleCredits)(
        reservationId,
        { credits: 0, inputTokens: 0, outputTokens: 0 },
      ).catch(() => {});
      session.inFlight = false;
      throw error;
    }

    session.history.push({ role: "user", parts: [{ text: trimmedMessage }] });

    const deps = this.deps;
    return (async function* () {
      let completeResponse = "";
      let cacheUsage: ProviderCacheUsage = {
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
      };
      // Só dispara chat_message_completed (com o breakdown de fases) depois
      // da liquidação de créditos no `finally` — succeeded marca se o
      // stream terminou bem, já que o finally roda nos dois casos (sucesso
      // e erro) e chat_message_interrupted já cobre o caminho de erro.
      let succeeded = false;
      const streamStartedAt = deps.now();
      let providerStreamMs = 0;

      try {
        let next = await stream.next();
        while (!next.done) {
          completeResponse += next.value;
          yield next.value;
          next = await stream.next();
        }
        providerStreamMs = deps.now() - streamStartedAt;
        if (next.value) cacheUsage = next.value;

        session.history.push({
          role: "model",
          parts: [{ text: completeResponse }],
        });
        session.messageCount += 1;
        succeeded = true;
      } catch (error) {
        providerStreamMs = deps.now() - streamStartedAt;
        session.history = historyBeforeMessage;
        deps.trackEvent("chat_message_interrupted", {
          session_message_count: session.messageCount,
        }, accountId);
        throw error;
      } finally {
        let creditSettleMs = 0;
        if (reservationId) {
          const actualCharge = deps.estimateChatCharge(
            trimmedMessage,
            [{ parts: [{ text: systemInstruction }] }, ...compactedHistory],
            billableModel,
            deps.estimateTokens(completeResponse),
            cacheUsage,
          );

          if (promptCacheAttempted && promptCacheProvider) {
            const totalCacheTokens = cacheUsage.cachedInputTokens +
              cacheUsage.cacheWriteTokens;
            deps.trackEvent(
              "chat_context_cache_used",
              {
                cached: cacheUsage.cachedInputTokens > 0 ? 1 : 0,
                cached_tokens: totalCacheTokens,
                provider: promptCacheProvider,
                credits_saved: actualCharge.creditsSaved,
              },
              accountId,
            );
          }

          const creditSettleStartedAt = deps.now();
          await (isTrial ? deps.settleTrialCredits : deps.settleCredits)(
            reservationId,
            actualCharge,
          ).catch(() => {});
          creditSettleMs = deps.now() - creditSettleStartedAt;
        }

        if (succeeded) {
          deps.trackEvent(
            "chat_message_completed",
            {
              entitlement: entitlementPlan,
              message_chars: trimmedMessage.length,
              response_chars: completeResponse.length,
              session_message_count: session.messageCount,
              duration_ms: deps.now() - requestStartedAt,
              phases: {
                entitlement_ms: entitlementMs,
                ...(cacheLookupMs > 0
                  ? { cache_lookup_ms: cacheLookupMs }
                  : {}),
                credit_reserve_ms: creditReserveMs,
                provider_stream_ms: providerStreamMs,
                credit_settle_ms: creditSettleMs,
              },
            },
            accountId,
          );
        }
        session.inFlight = false;
      }
    })();
  }
}
