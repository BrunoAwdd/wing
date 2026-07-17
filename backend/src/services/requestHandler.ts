import type { Context } from "../deps.ts";
import { track } from "./telemetry.ts";
import logger from "./logger.ts";
import { billingService } from "./billingService.ts";
import {
  generateTextStream,
  isProviderAvailable,
  resolveAvailableModel,
} from "./aiService.ts";
import type { PromptBuilder } from "../prompts.ts";
import { getWingAuth } from "../middlewares/authMiddleware.ts";
import {
  estimateActionCharge,
  estimateTokens,
  resolveActionModel,
  resolveBillableModel,
} from "./creditUsage.ts";
import {
  isQualityLevelAllowedForPlan,
  isSelectableQualityLevel,
  resolveQualityLevelModel,
} from "./qualityLevels.ts";

// Tipos que estavam em api.routes.ts
type Paragraph = { id: string; text: string };

// Opções enviadas pelo cliente no corpo da requisição — usadas tanto na
// resolução do modelo (`qualityLevel`) quanto na construção do prompt
// (`language`/`tone`, ver PromptBuilder em ../prompts.ts).
type RequestOptions = ActionModelOptions & { language?: string; tone?: string };

// Mesmo nome de env var usado em billing.routes.ts (/estimate) — o limite
// de tamanho é o mesmo pros dois, senão a estimativa aceita um texto que a
// execução real rejeitaria (ou vice-versa).
const MAX_ACTION_INPUT_CHARS = Number(
  Deno.env.get("WING_ACTION_MAX_INPUT_CHARS") || "120000",
);

interface ActionModelOptions {
  model?: string;
  qualityLevel?: unknown;
}

export interface RequestHandlerDependencies {
  generateTextStream: typeof generateTextStream;
  getEntitlement: typeof billingService.getEntitlement;
  reserveCredits: typeof billingService.reserveCredits;
  settleCredits: typeof billingService.settleCredits;
  reserveTrialCredits: typeof billingService.reserveTrialCredits;
  settleTrialCredits: typeof billingService.settleTrialCredits;
  trackEvent: typeof track;
}

const defaultDependencies: RequestHandlerDependencies = {
  generateTextStream,
  getEntitlement: billingService.getEntitlement,
  reserveCredits: billingService.reserveCredits,
  settleCredits: billingService.settleCredits,
  reserveTrialCredits: billingService.reserveTrialCredits,
  settleTrialCredits: billingService.settleTrialCredits,
  trackEvent: track,
};

// M6: plano free hoje É o teste grátis (concessão única, não mensal — ver
// migration 20260717120000_add_trial_credits.sql). Basic/Pro têm teto
// mensal próprio (antes, qualquer plano pago era ilimitado no código,
// desalinhado com o que o site promete). Team/enterprise ficam sem teto
// até M7 definir preço B2B.
const TRIAL_CREDIT_LIMIT = Number(
  Deno.env.get("WING_TRIAL_CREDIT_LIMIT") || "500",
);
const TRIAL_DURATION_SECONDS = Number(
  Deno.env.get("WING_TRIAL_DURATION_SECONDS") || `${30 * 24 * 60 * 60}`,
);
const MONTHLY_CREDIT_LIMITS: Partial<Record<string, number>> = {
  basic: Number(Deno.env.get("WING_BASIC_MONTHLY_CREDITS") || "3500"),
  pro: Number(Deno.env.get("WING_PRO_MONTHLY_CREDITS") || "8000"),
};

export const resolveActionExecutionModel = (
  actionName: string,
  options: ActionModelOptions | undefined,
  defaults: { generalModel?: string; translationModel?: string } = {},
): string =>
  actionName === "rewrite"
    ? resolveQualityLevelModel(options?.qualityLevel)
    : resolveActionModel(
      actionName,
      undefined,
      defaults.generalModel ?? Deno.env.get("GEMINI_MODEL"),
      defaults.translationModel ??
        Deno.env.get("WING_TRANSLATION_MODEL") ??
        "gemini-3.1-flash-lite",
    );

// Lógica de Rota movida para um handler de serviço
export const handleStreamRequest = async (
  ctx: Context,
  promptBuilder: PromptBuilder,
  actionName: string,
  dependencies: RequestHandlerDependencies = defaultDependencies,
) => {
  console.log("[HANDLER] 1. Entrou em handleStreamRequest");
  try {
    const { text: paragraphs, options } = (await ctx.request.body.json()) as {
      text: Paragraph[];
      options: RequestOptions;
    };
    console.log("[HANDLER] 2. Body da requisição parseado");
    const auth = getWingAuth(ctx);

    if (!paragraphs || paragraphs.length === 0) {
      console.log("[HANDLER] Erro: Parágrafos não fornecidos.");
      ctx.response.status = 400;
      ctx.response.body = {
        error: "O parâmetro 'text' (array de parágrafos) é obrigatório.",
      };
      return;
    }
    console.log("[HANDLER] 4. Input validado (parágrafos existem)");

    const totalChars = paragraphs.map((p) => p.text).join("\n").length;
    if (totalChars > MAX_ACTION_INPUT_CHARS) {
      ctx.response.status = 400;
      ctx.response.body = {
        error:
          `O texto excede o limite de ${MAX_ACTION_INPUT_CHARS} caracteres.`,
      };
      return;
    }

    // Telemetria: duração total + breakdown por fase (M5).
    const requestStartedAt = Date.now();
    const entitlementStartedAt = Date.now();
    const entitlement = await dependencies.getEntitlement(auth.accountId);
    const entitlementMs = Date.now() - entitlementStartedAt;

    // Autorização por nível (QUICK_MODEL_ROUTING_PLAN, gate de saída): ter
    // créditos suficientes não basta pra usar "profundo" — exige plano
    // pago. Sem isso, uma conta Free com créditos sobrando usaria o mesmo
    // modelo caro que só o plano Pro paga por assinatura. Bloqueia ANTES de
    // reservar crédito ou chamar a IA, igual à cota (RFC 015 §11).
    if (
      actionName === "rewrite" &&
      isSelectableQualityLevel(options?.qualityLevel) &&
      !isQualityLevelAllowedForPlan(options.qualityLevel, entitlement.plan)
    ) {
      ctx.response.status = 402;
      ctx.response.body = {
        error: "O nível Profundo requer o Wing Pro. Assine para usá-lo.",
        code: "quality_level_requires_upgrade",
      };
      return;
    }

    const structuredPrompt = promptBuilder(
      JSON.stringify(paragraphs, null, 2),
      options,
    );
    const maxOutputTokens = Number(
      Deno.env.get("WING_ACTION_MAX_OUTPUT_TOKENS") || "4096",
    );
    // "rewrite" é a única ação de texto que aceita nível de qualidade
    // (QUICK_MODEL_ROUTING_PLAN Entrega 2) — o cliente manda um nível
    // (rápido/equilibrado/profundo), nunca um nome de modelo; o backend
    // resolve o modelo real. As demais ações (fix, translate, summarize)
    // usam sempre um modelo fixo — nunca `options?.model` do cliente. Sem
    // essa segunda condição, um POST direto em /fix ou /summarize com
    // options.model="claude-opus-4.8" (ou qualquer outro) executava e
    // cobrava naquele modelo, ignorando por completo o catálogo protegido.
    const resolvedModel = resolveActionExecutionModel(actionName, options);
    const billableModel = resolveAvailableModel(
      resolvedModel,
      resolveBillableModel(Deno.env.get("GEMINI_MODEL")),
      Deno.env.get("NODE_ENV") === "production",
    );

    if (billableModel !== resolvedModel) {
      logger.warn(
        `[${actionName}] Modelo '${resolvedModel}' sem API key em desenvolvimento; usando '${billableModel}' como fallback.`,
      );
    }

    if (!isProviderAvailable(billableModel)) {
      const provider = billableModel.startsWith("gpt")
        ? "openai"
        : billableModel.startsWith("claude")
        ? "anthropic"
        : "gemini";
      logger.error(
        `[${actionName}] Provedor '${provider}' indisponível para o modelo '${billableModel}'. Verifique a API key correspondente.`,
      );
      ctx.response.status = 503;
      ctx.response.body = {
        error: "O modelo selecionado está temporariamente indisponível.",
        code: "model_provider_unavailable",
        provider,
        model: billableModel,
      };
      return;
    }

    const reservedCharge = estimateActionCharge(
      structuredPrompt,
      billableModel,
      maxOutputTokens,
    );

    // RFC 015 §11: cota é aplicada ANTES de chamar o provedor de IA.
    // Incremento atômico e condicional (função SQL) — evita condição de
    // corrida sob chamadas concorrentes da mesma conta, e não conta a
    // tentativa que estoura o limite (senão requests_count infla a cada
    // retry do usuário, mesmo sem nunca ter chamado a IA).
    //
    // "free" é o teste grátis: concessão única (não mensal), controlada
    // pelas RPCs reserve_trial_credits/settle_trial_credits contra
    // accounts.trial_credits_used. Planos pagos usam a cota mensal
    // tradicional (usage_monthly), com teto próprio por tier.
    const isTrial = entitlement.plan === "free";
    const settleReservedCredits = isTrial
      ? dependencies.settleTrialCredits
      : dependencies.settleCredits;
    const creditReserveStartedAt = Date.now();
    const reservation = isTrial
      ? await dependencies.reserveTrialCredits(
        auth.accountId,
        billableModel,
        reservedCharge.credits,
        TRIAL_CREDIT_LIMIT,
        TRIAL_DURATION_SECONDS,
      )
      : await dependencies.reserveCredits(
        auth.accountId,
        billableModel,
        reservedCharge.credits,
        MONTHLY_CREDIT_LIMITS[entitlement.plan] ?? null,
      );
    const creditReserveMs = Date.now() - creditReserveStartedAt;

    if (!reservation.allowed) {
      const trialExpired = isTrial && "trialExpired" in reservation &&
        reservation.trialExpired;
      console.log(
        trialExpired ? "[HANDLER] Teste grátis expirado." : "[HANDLER] Cota excedida.",
      );
      ctx.response.status = 402;
      ctx.response.body = {
        error: trialExpired
          ? "Seu teste grátis expirou. Assine um plano para continuar."
          : isTrial
          ? "Créditos do teste grátis esgotados. Assine um plano para continuar."
          : "Limite mensal do seu plano atingido. Faça upgrade para continuar.",
        code: trialExpired ? "trial_expired" : "quota_exceeded",
      };
      return;
    }

    dependencies.trackEvent(
      "prompt_sent",
      {
        command: actionName,
        text_length: totalChars,
        entitlement: entitlement.plan,
      },
      auth.accountId,
    );
    console.log("[HANDLER] 5. Evento de telemetria enviado");

    console.log("[HANDLER] 6. Prompt estruturado criado");

    try {
      console.log("[HANDLER] 7. Entrando no bloco try para chamada de IA");
      // Pass entitlement/plan to generateTextStream if needed for model selection
      const aiStream = dependencies.generateTextStream(structuredPrompt, {
        entitlement: entitlement.plan === "pro" || entitlement.plan === "team"
          ? "Paid"
          : "Free",
        model: billableModel,
        maxOutputTokens,
      });

      // Configura a resposta para streaming
      ctx.response.status = 200;
      ctx.response.headers.set("Content-Type", "application/jsonl"); // Ou text/event-stream
      ctx.response.headers.set("Cache-Control", "no-cache");
      ctx.response.headers.set("Connection", "keep-alive");

      const body = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          let buffer = "";
          let outputText = "";
          let outputItems = 0;
          // prompt_completed só dispara (com duration_ms/phases completos)
          // depois da liquidação de créditos no finally — succeeded marca
          // se o stream terminou bem, já que prompt_failed cobre o erro.
          let succeeded = false;
          const providerStreamStartedAt = Date.now();

          try {
            for await (const chunk of aiStream) {
              buffer += chunk;
              outputText += chunk;

              // Processa o buffer para encontrar JSONs completos (delimitados por nova linha)
              let newlineIndex;
              while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
                const line = buffer.slice(0, newlineIndex + 1);
                buffer = buffer.slice(newlineIndex + 1);

                // Limpa a linha se necessário (ex: remover ```json)
                let cleanedLine = line.trim();
                if (cleanedLine.startsWith("```json")) {
                  cleanedLine = cleanedLine.substring(7).trim();
                }
                if (cleanedLine.endsWith("```")) {
                  cleanedLine = cleanedLine.slice(0, -3).trim();
                }

                if (
                  cleanedLine &&
                  cleanedLine.startsWith("{") &&
                  cleanedLine.endsWith("}")
                ) {
                  controller.enqueue(encoder.encode(cleanedLine + "\n"));
                  outputItems += 1;
                }
              }
            }

            // Envia qualquer resto do buffer
            if (buffer.trim()) {
              let cleanedLine = buffer.trim();
              if (cleanedLine.startsWith("```json")) {
                cleanedLine = cleanedLine.substring(7).trim();
              }
              if (cleanedLine.endsWith("```")) {
                cleanedLine = cleanedLine.slice(0, -3).trim();
              }
              if (
                cleanedLine &&
                cleanedLine.startsWith("{") &&
                cleanedLine.endsWith("}")
              ) {
                controller.enqueue(encoder.encode(cleanedLine + "\n"));
                outputItems += 1;
              }
            }

            console.log(
              "[HANDLER] 8. Stream da IA finalizado e enviado para o cliente.",
            );
            succeeded = true;
          } catch (streamError) {
            logger.error(
              { err: streamError },
              `Erro durante o streaming da resposta da IA para /api/v1/${actionName}:`,
            );
            dependencies.trackEvent(
              "prompt_failed",
              { command: actionName, error_code: "provider_stream_failed" },
              auth.accountId,
            );
            controller.error(streamError);
          } finally {
            const providerStreamMs = Date.now() - providerStreamStartedAt;
            let creditSettleMs = 0;
            try {
              const actualCharge = estimateActionCharge(
                structuredPrompt,
                billableModel,
                estimateTokens(outputText),
              );
              const creditSettleStartedAt = Date.now();
              await settleReservedCredits(
                reservation.reservationId,
                actualCharge,
              );
              creditSettleMs = Date.now() - creditSettleStartedAt;
            } catch (settlementError) {
              logger.error(
                { err: settlementError },
                "Falha ao liquidar consumo de tokens.",
              );
            }
            if (succeeded) {
              dependencies.trackEvent(
                "prompt_completed",
                {
                  command: actionName,
                  output_items: outputItems,
                  duration_ms: Date.now() - requestStartedAt,
                  phases: {
                    entitlement_ms: entitlementMs,
                    credit_reserve_ms: creditReserveMs,
                    provider_stream_ms: providerStreamMs,
                    credit_settle_ms: creditSettleMs,
                  },
                },
                auth.accountId,
              );
            }
            controller.close();
          }
        },
      });

      ctx.response.body = body;
    } catch (innerError) {
      await settleReservedCredits(reservation.reservationId, {
        credits: 0,
        inputTokens: 0,
        outputTokens: 0,
      })
        .catch((settlementError) =>
          logger.error(
            { err: settlementError },
            "Falha ao liberar reserva de tokens.",
          )
        );
      logger.error(
        { err: innerError },
        `Erro na chamada de IA para /api/v1/${actionName}:`,
      );
      dependencies.trackEvent(
        "prompt_failed",
        { command: actionName, error_code: "provider_start_failed" },
        auth.accountId,
      );

      if (ctx.response.writable) {
        ctx.response.status = 500;
        ctx.response.body = {
          error: "Erro interno ao processar a solicitação de IA.",
        };
      }
    }
  } catch (outerError) {
    console.error(
      "[HANDLER] Erro catastrófico em handleStreamRequest:",
      outerError,
    );
    const auth = ctx.state.auth as { accountId?: string } | undefined;
    if (auth?.accountId) {
      dependencies.trackEvent(
        "prompt_failed",
        { command: actionName, error_code: "request_failed" },
        auth.accountId,
      );
    }
    // Se chegarmos aqui, algo muito errado aconteceu antes de podermos enviar uma resposta.
    // Não podemos mais setar o status/body se a conexão já foi fechada.
    if (ctx.response.writable) {
      ctx.response.status = 500;
      ctx.response.body = {
        error: "Um erro crítico e inesperado ocorreu no servidor.",
      };
    }
  }
};
