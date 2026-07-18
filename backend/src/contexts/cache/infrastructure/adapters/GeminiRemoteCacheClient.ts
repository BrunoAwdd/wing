import { GoogleAICacheManager } from "../../../../deps.ts";
import { RemoteCacheClient } from "../../application/ports/out/CachePorts.ts";

export class GeminiRemoteCacheClient implements RemoteCacheClient {
  private cacheManager: GoogleAICacheManager | null = null;
  
  private getCacheManager(): GoogleAICacheManager {
    if (!this.cacheManager) {
      const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
      if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurado.");
      this.cacheManager = new GoogleAICacheManager(GEMINI_API_KEY);
    }
    return this.cacheManager;
  }

  async create({ model, documentText, systemInstruction, ttlSeconds }: {
    model: string;
    documentText: string;
    systemInstruction: string;
    ttlSeconds: number;
  }): Promise<{ name: string; } | null> {
    try {
      const qualifiedModel = model.startsWith("models/") ? model : `models/${model}`;
      const result = await this.getCacheManager().create({
        model: qualifiedModel,
        systemInstruction,
        contents: [{ role: "user", parts: [{ text: documentText }] }],
        ttlSeconds,
      });
      if (!result.name) return null;
      return { name: result.name };
    } catch (error) {
      console.error(
        "[GeminiContextCache] Falha ao criar cache de prompt:",
        error,
      );
      return null;
    }
  }

  async delete(name: string): Promise<void> {
    await this.getCacheManager().delete(name);
  }
}
