import { AIProvider, AIRequestOptions } from "./providerInterface.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

export class OpenAIProvider implements AIProvider {
  constructor() {
    if (!OPENAI_API_KEY) {
      console.warn(
        "OPENAI_API_KEY not set. OpenAI provider will fail if used."
      );
    }
  }

  async *generateContentStream(
    prompt: string,
    options?: AIRequestOptions
  ): AsyncGenerator<string, void, unknown> {
    const model = options?.model || "gpt-4o-mini";

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
            content:
              options?.systemInstruction || "You are a helpful assistant.",
          },
          { role: "user", content: prompt },
        ],
        temperature: options?.temperature ?? 0.7,
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
    history: any[],
    options?: AIRequestOptions
  ): AsyncGenerator<string, void, unknown> {
    // Convert history to OpenAI format if needed, or assume it's compatible
    // Wing history format: { role: 'user'|'model', parts: [{text: '...'}] }
    // OpenAI format: { role: 'user'|'assistant', content: '...' }

    const messages = history.map((h) => ({
      role: h.role === "model" ? "assistant" : h.role,
      content: h.parts?.[0]?.text || h.content, // Handle both formats
    }));

    messages.push({ role: "user", content: prompt });

    const model = options?.model || "gpt-4o-mini";

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

  async generateStructuredContent(
    prompt: string,
    schema: object,
    options?: AIRequestOptions
  ): Promise<string> {
    const model = options?.model || "gpt-4o-mini";

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
            content:
              options?.systemInstruction ||
              `Responda APENAS com um JSON válido que siga este schema: ${JSON.stringify(schema)}`,
          },
          { role: "user", content: prompt },
        ],
        temperature: options?.temperature ?? 0,
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
