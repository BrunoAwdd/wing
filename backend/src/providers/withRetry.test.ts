import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { AIProvider, CacheUsage } from "./providerInterface.ts";
import { withRetry } from "./withRetry.ts";

const providerReturningCacheUsage = (cacheUsage: CacheUsage): AIProvider => ({
  async *generateContentStream() {
    yield "content";
  },
  async *generateChatStream() {
    yield "answer";
    return cacheUsage;
  },
  async generateStructuredContent() {
    return "{}";
  },
});

Deno.test("withRetry: preserva a repartição real de tokens de cache do provider (hit)", async () => {
  const stream = withRetry(
    providerReturningCacheUsage({ cachedInputTokens: 512, cacheWriteTokens: 0 }),
  ).generateChatStream("question", []);

  const first = await stream.next();
  const last = await stream.next();

  assertEquals(first, { value: "answer", done: false });
  assertEquals(last, { value: { cachedInputTokens: 512, cacheWriteTokens: 0 }, done: true });
});

Deno.test("withRetry: preserva escrita de cache do provider (Anthropic)", async () => {
  const stream = withRetry(
    providerReturningCacheUsage({ cachedInputTokens: 0, cacheWriteTokens: 800 }),
  ).generateChatStream("question", []);

  await stream.next();
  const last = await stream.next();

  assertEquals(last, { value: { cachedInputTokens: 0, cacheWriteTokens: 800 }, done: true });
});

Deno.test("withRetry: preserva cache miss do provider (0 tokens nos dois campos)", async () => {
  const stream = withRetry(
    providerReturningCacheUsage({ cachedInputTokens: 0, cacheWriteTokens: 0 }),
  ).generateChatStream("question", []);

  await stream.next();
  const last = await stream.next();

  assertEquals(last, { value: { cachedInputTokens: 0, cacheWriteTokens: 0 }, done: true });
});
