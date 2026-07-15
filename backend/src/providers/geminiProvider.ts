import { GoogleGenerativeAI } from "../deps.ts";
import { AIProvider, CacheUsage } from "./providerInterface.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-flash-3.5";

class GeminiProvider implements AIProvider {
  private readonly genAI: GoogleGenerativeAI;
  private readonly model: string;

  constructor() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === "SUA_CHAVE_API_AQUI") {
      throw new Error("API key do Gemini não está configurada no servidor.");
    }
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    this.model = GEMINI_MODEL;
  }

  async *generateContentStream(
    prompt: string,
    options?: {
      model?: string;
      temperature?: number;
      entitlement?: string;
      systemInstruction?: string;
      maxOutputTokens?: number;
    },
  ): AsyncGenerator<string, void, unknown> {
    // Seleciona o modelo com base no nível da licença ou opção explícita
    let modelName = this.model;

    if (options?.model) {
      modelName = options.model;
    }

    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? 0,
        maxOutputTokens: options?.maxOutputTokens,
      },
      systemInstruction: options?.systemInstruction,
    });

    console.log(
      `Usando modelo: ${modelName} para o nível de acesso: ${
        options?.entitlement ?? "Unknown"
      }`,
    ); // Log para depuração

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }

  async *generateChatStream(
    prompt: string,
    history: any[],
    options?: {
      model?: string;
      temperature?: number;
      entitlement?: string;
      systemInstruction?: string;
      maxOutputTokens?: number;
      cachedContentName?: string;
    },
  ): AsyncGenerator<string, CacheUsage, unknown> {
    const modelName = options?.model || GEMINI_MODEL;
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? 0,
        maxOutputTokens: options?.maxOutputTokens,
      },
      // M4.5: com cache de prompt (documento + instrução já armazenados no
      // provedor), reenviar systemInstruction seria redundante — o cache é
      // referenciado abaixo por nome em `startChat`.
      systemInstruction: options?.cachedContentName ? undefined : options?.systemInstruction,
    });
    const chat = model.startChat({
      history: history,
      cachedContent: options?.cachedContentName,
    });

    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      yield chunk.text();
    }

    // Prova real de economia (tokens do prefixo que vieram do cache, não
    // reprocessados) e do total lógico de entrada — só disponíveis depois
    // que o stream inteiro é consumido. Propagado via `return` pro chamador
    // registrar telemetria e cobrança com a economia de verdade. Gemini não
    // tem um custo de "escrita" de cache por token nesta chamada (o cache é
    // criado à parte, via GoogleAICacheManager, com tarifa por tempo de
    // armazenamento, não por token) — sempre 0 aqui.
    try {
      const finalResponse = await result.response;
      const cachedInputTokens = options?.cachedContentName
        ? finalResponse.usageMetadata?.cachedContentTokenCount ?? 0
        : 0;
      const totalInputTokens = finalResponse.usageMetadata?.promptTokenCount;
      if (options?.cachedContentName) {
        console.log(
          `[GeminiProvider] cache "${options.cachedContentName}": ${cachedInputTokens} tokens do prefixo vieram do cache.`,
        );
      }
      return { cachedInputTokens, cacheWriteTokens: 0, totalInputTokens };
    } catch (error) {
      console.error("[GeminiProvider] Falha ao ler usageMetadata do cache:", error);
      return { cachedInputTokens: 0, cacheWriteTokens: 0 };
    }
  }

  async generateStructuredContent(
    prompt: string,
    schema: object,
    options?: {
      model?: string;
      temperature?: number;
      entitlement?: string;
      systemInstruction?: string;
      maxOutputTokens?: number;
    },
  ): Promise<string> {
    const modelName = options?.model || this.model;
    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        temperature: options?.temperature ?? 0,
        maxOutputTokens: options?.maxOutputTokens,
        responseMimeType: "application/json",
        responseSchema: schema as any,
      },
      systemInstruction: options?.systemInstruction,
    });

    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}

export const geminiProvider = new GeminiProvider();
