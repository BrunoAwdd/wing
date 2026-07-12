import { AIProvider, AIRequestOptions } from "./providerInterface.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

export class AnthropicProvider implements AIProvider {
  constructor() {
    if (!ANTHROPIC_API_KEY) {
      console.warn(
        "ANTHROPIC_API_KEY not set. Anthropic provider will fail if used."
      );
    }
  }

  async *generateContentStream(
    prompt: string,
    options?: AIRequestOptions
  ): AsyncGenerator<string, void, unknown> {
    const model = options?.model || "claude-3-5-sonnet-20240620";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        system: options?.systemInstruction,
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${error}`);
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
        if (line.startsWith("event: ")) continue;
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "content_block_delta" && data.delta?.text) {
              yield data.delta.text;
            }
          } catch (e) {
            console.error("Error parsing Anthropic chunk", e);
          }
        }
      }
    }
  }

  async *generateChatStream(
    prompt: string,
    history: any[],
    options?: AIRequestOptions
  ): AsyncGenerator<string, void, unknown> {
    const model = options?.model || "claude-3-5-sonnet-20240620";

    // Convert history
    // Wing: { role: 'user'|'model', parts: [{text: '...'}] }
    // Anthropic: { role: 'user'|'assistant', content: '...' }
    const messages = history.map((h) => ({
      role: h.role === "model" ? "assistant" : h.role,
      content: h.parts?.[0]?.text || h.content,
    }));

    messages.push({ role: "user", content: prompt });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        system: options?.systemInstruction,
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        stream: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${error}`);
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
        if (line.startsWith("event: ")) continue;
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "content_block_delta" && data.delta?.text) {
              yield data.delta.text;
            }
          } catch (e) {
            console.error("Error parsing Anthropic chunk", e);
          }
        }
      }
    }
  }

  async generateStructuredContent(
    prompt: string,
    schema: object,
    options?: AIRequestOptions
  ): Promise<string> {
    const model = options?.model || "claude-3-5-sonnet-20240620";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4096,
        system:
          options?.systemInstruction ||
          `Responda APENAS com um JSON válido, sem texto ao redor, seguindo este schema: ${JSON.stringify(schema)}`,
        messages: [{ role: "user", content: prompt }],
        temperature: options?.temperature ?? 0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API Error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.content?.[0]?.text ?? "";
  }
}

export const anthropicProvider = new AnthropicProvider();
