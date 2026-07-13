import { track } from "./telemetry.ts";
import logger from "./logger.ts";
import { billingService } from "./billingService.ts";
import { generateTextStream } from "./aiService.ts";
import type { PromptBuilder } from "../prompts.ts";
import { getWingAuth } from "../middlewares/authMiddleware.ts";

// Tipos que estavam em api.routes.ts
type Paragraph = { id: string; text: string };

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

    const entitlement = await billingService.getEntitlement(auth.accountId);

    // Calculate tokens (approximation for now: 1 word ~ 1.3 tokens, or just char count / 4)
    const totalChars = paragraphs.map((p) => p.text).join("\n").length;
    const estimatedTokens = Math.ceil(totalChars / 4);

    // NEW: Track usage
    // Fire and forget usage tracking to not block response.
    billingService.incrementUsage(auth.accountId, estimatedTokens).catch(
      (err) => {
        console.error("[HANDLER] Failed to track usage:", err);
      },
    );

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

    const structuredPrompt = promptBuilder(
      JSON.stringify(paragraphs, null, 2),
      options,
    );
    console.log("[HANDLER] 6. Prompt estruturado criado");

    try {
      console.log("[HANDLER] 7. Entrando no bloco try para chamada de IA");
      // Pass entitlement/plan to generateTextStream if needed for model selection
      const aiStream = generateTextStream(structuredPrompt, {
        entitlement: entitlement.plan === "pro" || entitlement.plan === "team"
          ? "Paid"
          : "Free",
        model: options?.model,
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

          try {
            for await (const chunk of aiStream) {
              buffer += chunk;

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
              }
            }

            console.log(
              "[HANDLER] 8. Stream da IA finalizado e enviado para o cliente.",
            );
          } catch (streamError) {
            logger.error(
              { err: streamError },
              `Erro durante o streaming da resposta da IA para /api/v1/${actionName}:`,
            );
            controller.error(streamError);
          } finally {
            controller.close();
          }
        },
      });

      ctx.response.body = body;
    } catch (innerError) {
      logger.error(
        { err: innerError },
        `Erro na chamada de IA para /api/v1/${actionName}:`,
      );
      const errorMessage = innerError instanceof Error
        ? innerError.message
        : String(innerError);
      track("error", {
        type: "api_error",
        message: errorMessage,
        route: `/api/v1/${actionName}`,
      });

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
