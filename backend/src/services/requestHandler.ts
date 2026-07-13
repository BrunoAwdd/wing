import { track } from "./telemetry.ts";
import logger from "./logger.ts";
import { billingService } from "./billingService.ts";
import { generateTextStream } from "./aiService.ts";
import type { PromptBuilder } from "../prompts.ts";
import { getWingAuth } from "../middlewares/authMiddleware.ts";
import {
  estimateActionCharge,
  estimateTokens,
  resolveActionModel,
} from "./creditUsage.ts";
import {
  isQualityLevelAllowedForPlan,
  isSelectableQualityLevel,
  resolveQualityLevelModel,
} from "./qualityLevels.ts";

// Tipos que estavam em api.routes.ts
type Paragraph = { id: string; text: string };

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
      defaults.translationModel ?? Deno.env.get("WING_TRANSLATION_MODEL") ??
        "gemini-2.5-flash-lite",
    );

// Helper para coletar o stream da IA
async function collectStream(stream: AsyncGenerator<string>): Promise<string> {
  let content = "";
  for await (const chunk of stream) {
    content += chunk;
  }
  return content;
}

// Lógica de Rota movida para um handler de serviço
export const handleStreamRequest = async (
  ctx: any, // TODO: Usar um tipo de contexto mais específico do Oak
  promptBuilder: PromptBuilder,
  actionName: string,
) => {
  console.log("[HANDLER] 1. Entrou em handleStreamRequest");
  try {
    const { text: paragraphs, options } = (await ctx.request.body.json()) as {
      text: Paragraph[];
      options: any;
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

    const entitlement = await billingService.getEntitlement(auth.accountId);

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
    const billableModel = resolveActionExecutionModel(actionName, options);
    const reservedCharge = estimateActionCharge(
      structuredPrompt,
      billableModel,
      maxOutputTokens,
    );

    // RFC 015 §11: cota Free é aplicada ANTES de chamar o provedor de IA.
    // Incremento atômico e condicional (função SQL) — evita condição de
    // corrida sob chamadas concorrentes da mesma conta, e não conta a
    // tentativa que estoura o limite (senão requests_count infla a cada
    // retry do usuário, mesmo sem nunca ter chamado a IA).
    const freeMonthlyLimit = Number(
      Deno.env.get("WING_FREE_MONTHLY_CREDITS") || "1000",
    );
    const usageLimit = entitlement.plan === "free" ? freeMonthlyLimit : null;
    const reservation = await billingService.reserveCredits(
      auth.accountId,
      billableModel,
      reservedCharge.credits,
      usageLimit,
    );

    if (!reservation.allowed) {
      console.log("[HANDLER] Cota Free excedida.");
      ctx.response.status = 402;
      ctx.response.body = {
        error:
          "Limite mensal do plano Free atingido. Assine o Wing Pro para continuar.",
        code: "quota_exceeded",
      };
      return;
    }

    track(
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
      const aiStream = generateTextStream(structuredPrompt, {
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
            track(
              "prompt_completed",
              { command: actionName, output_items: outputItems },
              auth.accountId,
            );
          } catch (streamError) {
            logger.error(
              { err: streamError },
              `Erro durante o streaming da resposta da IA para /api/v1/${actionName}:`,
            );
            track(
              "prompt_failed",
              { command: actionName, error_code: "provider_stream_failed" },
              auth.accountId,
            );
            controller.error(streamError);
          } finally {
            try {
              const actualCharge = estimateActionCharge(
                structuredPrompt,
                billableModel,
                estimateTokens(outputText),
              );
              await billingService.settleCredits(
                reservation.reservationId,
                actualCharge,
              );
            } catch (settlementError) {
              logger.error(
                { err: settlementError },
                "Falha ao liquidar consumo de tokens.",
              );
            }
            controller.close();
          }
        },
      });

      ctx.response.body = body;
    } catch (innerError) {
      await billingService.settleCredits(reservation.reservationId, {
        credits: 0,
        inputTokens: 0,
        outputTokens: 0,
      }).catch(
        (settlementError) =>
          logger.error(
            { err: settlementError },
            "Falha ao liberar reserva de tokens.",
          ),
      );
      logger.error(
        { err: innerError },
        `Erro na chamada de IA para /api/v1/${actionName}:`,
      );
      track(
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
      track(
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
