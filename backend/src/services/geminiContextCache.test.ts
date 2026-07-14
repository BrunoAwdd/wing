import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createGeminiContextCache,
  hashDocumentKey,
} from "./geminiContextCache.ts";

const params = (
  overrides: Partial<
    Parameters<ReturnType<typeof createGeminiContextCache>["getOrCreate"]>[0]
  > = {},
) => ({
  accountId: "acc_1",
  documentText: "Este é o documento de teste.",
  model: "gemini-3.1-flash-lite",
  systemInstruction: "Você é um assistente.",
  ttlSeconds: 300,
  appSessionId: "app-session-1",
  ...overrides,
});

Deno.test(
  "geminiContextCache: cria na primeira chamada, reusa (hit) na segunda dentro do TTL",
  async () => {
    let createCalls = 0;
    let now = 0;
    const cache = createGeminiContextCache({
      now: () => now,
      client: {
        create: async () => {
          createCalls += 1;
          return { name: `cachedContents/${createCalls}` };
        },
      },
    });

    const first = await cache.getOrCreate(params());
    const second = await cache.getOrCreate(params());

    assertEquals(createCalls, 1);
    assertEquals(first?.hit, false);
    assertEquals(second?.hit, true);
    assertEquals(first?.name, second?.name);
  },
);

Deno.test("geminiContextCache: expira pelo TTL e cria de novo", async () => {
  let createCalls = 0;
  let now = 0;
  const cache = createGeminiContextCache({
    now: () => now,
    client: {
      create: async () => {
        createCalls += 1;
        return { name: `cachedContents/${createCalls}` };
      },
    },
  });

  await cache.getOrCreate(params({ ttlSeconds: 60 }));
  now = 61_000; // 61s depois — TTL de 60s expirado
  const afterExpiry = await cache.getOrCreate(params({ ttlSeconds: 60 }));

  assertEquals(createCalls, 2);
  assertEquals(afterExpiry?.hit, false);
});

Deno.test(
  "geminiContextCache: chaves diferentes (conta, documento, modelo, versão, app session) nunca colidem",
  async () => {
    const createdKeys = new Set<string>();
    const cache = createGeminiContextCache({
      now: () => 0,
      client: {
        create: async () => ({ name: `cachedContents/${createdKeys.size}` }),
      },
    });

    await cache.getOrCreate(params({ accountId: "acc_1" }));
    await cache.getOrCreate(params({ accountId: "acc_2" }));
    await cache.getOrCreate(params({ documentText: "outro documento" }));
    await cache.getOrCreate(params({ model: "claude-sonnet-5" }));
    await cache.getOrCreate(params({ promptVersion: "v2" }));
    await cache.getOrCreate(
      params({ systemInstruction: "instrução revisada" }),
    );
    await cache.getOrCreate(params({ appSessionId: "app-session-2" }));

    assertEquals(cache.size(), 7);
  },
);

Deno.test(
  "M4.6 geminiContextCache: duas app sessions no mesmo documento não reaproveitam o cache uma da outra",
  async () => {
    let createCalls = 0;
    const cache = createGeminiContextCache({
      now: () => 0,
      client: {
        create: async () => {
          createCalls += 1;
          return { name: `cachedContents/${createCalls}` };
        },
      },
    });

    const first = await cache.getOrCreate(params({ appSessionId: "app-a" }));
    const second = await cache.getOrCreate(params({ appSessionId: "app-b" }));

    assertEquals(createCalls, 2);
    assertEquals(first?.hit, false);
    assertEquals(second?.hit, false);
    assertEquals(first?.name === second?.name, false);
  },
);

Deno.test(
  "geminiContextCache: falha da API retorna null sem quebrar (segue sem cache)",
  async () => {
    const cache = createGeminiContextCache({
      now: () => 0,
      client: { create: async () => null },
    });

    const result = await cache.getOrCreate(params());
    assertEquals(result, null);
    assertEquals(cache.size(), 0);
  },
);

Deno.test(
  "hashDocumentKey: mesmo conteúdo gera a mesma chave; conteúdo diferente gera chave diferente",
  async () => {
    const a = await hashDocumentKey(
      "acc",
      "documento X",
      "gemini-3.1-flash-lite",
      "app-session-1",
    );
    const b = await hashDocumentKey(
      "acc",
      "documento X",
      "gemini-3.1-flash-lite",
      "app-session-1",
    );
    const c = await hashDocumentKey(
      "acc",
      "documento Y",
      "gemini-3.1-flash-lite",
      "app-session-1",
    );
    const d = await hashDocumentKey(
      "acc",
      "documento X",
      "gemini-3.1-flash-lite",
      "app-session-2",
    );

    assertEquals(a, b);
    assertEquals(a === c, false);
    assertEquals(a === d, false);
  },
);
