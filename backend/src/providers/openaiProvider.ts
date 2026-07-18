import { AIProvider, AIRequestOptions, CacheUsage, ChatHistoryEntry } from "./providerInterface.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

export class OpenAIProvider implements AIProvider {
  constructor() {
    if (!OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY not set. OpenAI provider will fail if used.",
      );
    }
  }

  async *generateContentStream(
    prompt: string,
    options?: AIRequestOptions,
  ): AsyncGenerator<string, void, unknown> {
    const model = options?.model || "gpt-5.6-terra";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: options?.systemInstruction ||
              "You are a helpful assistant.",
          },
          { role: "user", content: prompt },
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${error}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        if (line.trim() === "data: [DONE]") continue;
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices[0]?.delta?.content;
            if (content) yield content;
          } catch (e) {
            console.error("Error parsing OpenAI chunk", e);
          }
        }
      }
    }
  }

  async *generateChatStream(
    prompt: string,
    history: ChatHistoryEntry[],
    options?: AIRequestOptions,
  ): AsyncGenerator<string, CacheUsage, unknown> {
    // Convert history to OpenAI format if needed, or assume it's compatible
    // Wing history format: { role: 'user'|'model', parts: [{text: '...'}] }
    // OpenAI format: { role: 'user'|'assistant', content: '...' }

    const messages = history.map((h) => ({
      role: h.role === "model" ? "assistant" : h.role,
      content: h.parts[0]?.text ?? "",
    }));

    messages.push({ role: "user", content: prompt });

    const model = options?.model || "gpt-5.6-terra";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          ...(options?.systemInstruction
            ? [{ role: "system", content: options.systemInstruction }]
            : []),
          ...messages,
        ],
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.maxOutputTokens,
        stream: true,
        // M4.5: a OpenAI cacheia automaticamente prefixos estáveis
        // (>=1024 tokens) — não existe API de criação explícita, só
        // pedimos os metadados de uso pra saber se o cache foi usado.
        // O `systemInstruction` (documento) já é o primeiro elemento de
        // `messages`, então é o prefixo mais estável — posicionamento
        // correto pro cache automático reconhecer.
        ...(options?.enablePromptCache
          ? { stream_options: { include_usage: true } }
          : {}),
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${error}`);
    }

    if (!response.body) throw new Error("No response body");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let cachedTokens = 0;
    // `usage.prompt_tokens` da OpenAI já é o total lógico de entrada
    // (`cached_tokens` é um subconjunto dele, não somado por cima) — só
    // chega no chunk final, e só quando `stream_options.include_usage` foi
    // pedido (acima, condicionado a `enablePromptCache`).
    let totalInputTokens: number | undefined;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.trim() === "") continue;
        if (line.trim() === "data: [DONE]") continue;
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            const content = data.choices?.[0]?.delta?.content;
            if (content) yield content;
            if (data.usage?.prompt_tokens_details?.cached_tokens) {
              cachedTokens = data.usage.prompt_tokens_details.cached_tokens;
            }
            if (typeof data.usage?.prompt_tokens === "number") {
              totalInputTokens = data.usage.prompt_tokens;
            }
          } catch (e) {
            console.error("Error parsing OpenAI chunk", e);
          }
        }
      }
    }

    if (options?.enablePromptCache) {
      console.log(`[OpenAIProvider] ${cachedTokens} tokens do prefixo vieram do cache.`);
    }
    // A OpenAI não tem um custo de "escrita" de cache distinto — a primeira
    // chamada que estabelece o prefixo cacheável é cobrada como entrada
    // normal, sem sobretaxa. Sempre 0 aqui.
    return { cachedInputTokens: cachedTokens, cacheWriteTokens: 0, totalInputTokens };
  }

  async generateStructuredContent(
    prompt: string,
    schema: object,
    options?: AIRequestOptions,
  ): Promise<string> {
    const model = options?.model || "gpt-5.6-terra";

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: options?.systemInstruction ||
              `Responda APENAS com um JSON válido que siga este schema: ${
                JSON.stringify(schema)
              }`,
          },
          { role: "user", content: prompt },
        ],
        temperature: options?.temperature ?? 0,
        max_tokens: options?.maxOutputTokens,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content ?? "";
  }
}

export const openaiProvider = new OpenAIProvider();
