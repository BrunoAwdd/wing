import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import type { AIProvider } from "./providerInterface.ts";
import { withRetry } from "./withRetry.ts";

const providerReturningCachedTokens = (cachedTokens: number): AIProvider => ({
  async *generateContentStream() {
    yield "content";
  },
  async *generateChatStream() {
    yield "answer";
    return cachedTokens;
  },
  async generateStructuredContent() {
    return "{}";
  },
});

Deno.test("withRetry: preserva a contagem real de tokens cacheados do provider (hit)", async () => {
  const stream = withRetry(providerReturningCachedTokens(512)).generateChatStream(
    "question",
    [],
  );

  const first = await stream.next();
  const last = await stream.next();

  assertEquals(first, { value: "answer", done: false });
  assertEquals(last, { value: 512, done: true });
});

Deno.test("withRetry: preserva cache miss do provider (0 tokens)", async () => {
  const stream = withRetry(providerReturningCachedTokens(0)).generateChatStream(
    "question",
    [],
  );

  await stream.next();
  const last = await stream.next();

  assertEquals(last, { value: 0, done: true });
});
