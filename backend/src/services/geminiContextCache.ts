export { PROMPT_VERSION, hashDocumentKey } from "../contexts/cache/domain/PromptCacheKey.ts";
import { PromptCacheUseCases, CachedPrefix } from "../contexts/cache/application/use-cases/PromptCacheUseCases.ts";
import { RemoteCacheClient } from "../contexts/cache/application/ports/out/CachePorts.ts";
import { GeminiRemoteCacheClient } from "../contexts/cache/infrastructure/adapters/GeminiRemoteCacheClient.ts";

export type { CachedPrefix };

export interface CacheClient extends RemoteCacheClient {}

export const realCacheClient = new GeminiRemoteCacheClient();

export interface GeminiContextCacheDependencies {
  client: CacheClient;
  now: () => number;
  sleep?: (delayMs: number) => Promise<void>;
  createTimeoutMs?: number;
}

const defaultDependencies: GeminiContextCacheDependencies = {
  client: realCacheClient,
  now: Date.now,
  sleep: (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
  createTimeoutMs: 30_000,
};

export const createGeminiContextCache = (
  dependencies: GeminiContextCacheDependencies = defaultDependencies,
) => {
  const timeProvider = { now: dependencies.now };
  const sleepProvider = { sleep: dependencies.sleep ?? defaultDependencies.sleep! };
  const createTimeoutMs = dependencies.createTimeoutMs ?? defaultDependencies.createTimeoutMs!;

  const useCases = new PromptCacheUseCases(
    dependencies.client,
    timeProvider,
    sleepProvider,
    createTimeoutMs
  );

  return {
    getOrCreate: async (params: {
      accountId: string;
      documentText: string;
      model: string;
      systemInstruction: string;
      ttlSeconds: number;
      appSessionId: string;
      promptVersion?: string;
    }) => {
      return useCases.getOrCreate(params);
    },
    invalidateAppSession: async (appSessionId: string): Promise<void> => {
      await useCases.invalidateAppSession(appSessionId);
    },
    size: () => useCases.size(),
  };
};

export const geminiContextCache = createGeminiContextCache();
