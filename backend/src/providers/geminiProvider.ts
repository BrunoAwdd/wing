import { GoogleGenerativeAI } from "../deps.ts";
import { AIProvider } from "./providerInterface.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
const GEMINI_MODEL = Deno.env.get("GEMINI_MODEL") || "gemini-1.5-flash";

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
    entitlement: string
  ): AsyncGenerator<string, void, unknown> {
    // Seleciona o modelo com base no nível da licença
    const modelName =
      entitlement === "Paid"
        ? "gemini-1.5-pro" // Modelo superior para usuários pagos
        : this.model; // Modelo padrão (gemini-1.5-flash) para usuários gratuitos

    const model = this.genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { temperature: 0 },
    });

    console.log(
      `Usando modelo: ${modelName} para o nível de acesso: ${entitlement}`
    ); // Log para depuração

    const result = await model.generateContentStream(prompt);

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }

  async *generateChatStream(
    prompt: string,
    history: any[]
  ): AsyncGenerator<string, void, unknown> {
    const model = this.genAI.getGenerativeModel({ model: GEMINI_MODEL });
    const chat = model.startChat({
      history: history,
    });

    const result = await chat.sendMessageStream(prompt);

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  }
}

export const geminiProvider = new GeminiProvider();