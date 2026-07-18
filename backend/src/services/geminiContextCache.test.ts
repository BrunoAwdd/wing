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
    const now = 0;
    const cache = createGeminiContextCache({
      now: () => now,
      client: {
        create: async () => {
          createCalls += 1;
          return { name: `cachedContents/${createCalls}` };
        },
        delete: async () => {},
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
      delete: async () => {},
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
        delete: async () => {},
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
        delete: async () => {},
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
      client: { create: async () => null, delete: async () => {} },
    });

    const result = await cache.getOrCreate(params());
    assertEquals(result, null);
    assertEquals(cache.size(), 0);
  },
);

Deno.test(
  "M4.7 geminiContextCache: create() em voo quando a sessão termina não deixa entrada órfã no cache",
  async () => {
    const deletedNames: string[] = [];
    let resolveCreate!: (value: { name: string }) => void;
    const createPromise = new Promise<{ name: string }>((resolve) => {
      resolveCreate = resolve;
    });
    const cache = createGeminiContextCache({
      now: () => 0,
      client: {
        create: async () => await createPromise,
        delete: async (name) => {
          deletedNames.push(name);
        },
      },
    });

    // getOrCreate() começa, mas o `create()` ainda não resolveu.
    const getOrCreatePromise = cache.getOrCreate(
      params({ appSessionId: "app-a" }),
    );

    // A sessão termina ENQUANTO o create() ainda está em voo — não há
    // nenhuma entrada no mapa pra invalidateAppSession() encontrar ainda.
    await cache.invalidateAppSession("app-a");
    assertEquals(cache.size(), 0);

    // Agora o create() em voo finalmente resolve.
    resolveCreate({ name: "cachedContents/orphan" });
    const result = await getOrCreatePromise;

    // Não deve ter sido inserida no mapa, e o cache remoto recém-criado
    // deve ter sido excluído — não fica pago no Gemini até o TTL vencer.
    assertEquals(result, null);
    assertEquals(cache.size(), 0);
    assertEquals(deletedNames, ["cachedContents/orphan"]);
  },
);

Deno.test(
  "M4.7 geminiContextCache: create que termina depois do timeout é excluído remotamente",
  async () => {
    let resolveCreate!: (value: { name: string }) => void;
    const deletedNames: string[] = [];
    const cache = createGeminiContextCache({
      now: () => 0,
      createTimeoutMs: 1,
      client: {
        create: () =>
          new Promise((resolve) => {
            resolveCreate = resolve;
          }),
        delete: async (name) => {
          deletedNames.push(name);
        },
      },
    });

    const result = await cache.getOrCreate(params());
    assertEquals(result, null);

    resolveCreate({ name: "cachedContents/late" });
    await new Promise((resolve) => setTimeout(resolve, 0));

    assertEquals(cache.size(), 0);
    assertEquals(deletedNames, ["cachedContents/late"]);
  },
);

Deno.test(
  "M4.7 geminiContextCache: delete remoto transiente é repetido com backoff",
  async () => {
    let deleteAttempts = 0;
    const delays: number[] = [];
    const cache = createGeminiContextCache({
      now: () => 0,
      sleep: async (delay) => {
        delays.push(delay);
      },
      client: {
        create: async () => ({ name: "cachedContents/retry" }),
        delete: async () => {
          deleteAttempts += 1;
          if (deleteAttempts < 3) throw new Error("temporário");
        },
      },
    });

    await cache.getOrCreate(params());
    await cache.invalidateAppSession("app-session-1");

    assertEquals(deleteAttempts, 3);
    assertEquals(delays, [1_000, 5_000]);
    assertEquals(cache.size(), 0);
  },
);

Deno.test(
  "M4.7 geminiContextCache: invalidateAppSession remove só as entradas da app session encerrada e chama delete no client",
  async () => {
    let createCalls = 0;
    let now = 0;
    const deletedNames: string[] = [];
    const cache = createGeminiContextCache({
      now: () => now,
      client: {
        create: async () => {
          createCalls += 1;
          return { name: `cachedContents/${createCalls}` };
        },
        delete: async (name) => {
          deletedNames.push(name);
        },
      },
    });

    const first = await cache.getOrCreate(params({ appSessionId: "app-a" }));
    // TTL bem maior que o avanço de relógio abaixo — o teste avança `now`
    // pra além da janela do tombstone de app-a, e essa entrada de app-b
    // precisa continuar válida (não expirar por TTL) até o fim do teste.
    await cache.getOrCreate(
      params({ appSessionId: "app-b", ttlSeconds: 3_600 }),
    );
    assertEquals(cache.size(), 2);

    await cache.invalidateAppSession("app-a");

    assertEquals(cache.size(), 1);
    assertEquals(deletedNames, [first?.name]);

    // Na vida real um appSessionId nunca é reutilizado (é um UUID novo por
    // `register()`) — mas mesmo que fosse, o tombstone que protege contra a
    // corrida com um `create()` em voo (ver o outro teste M4.7 acima) não
    // deveria bloquear pra sempre. Avança além da janela de tolerância do
    // tombstone antes de tentar de novo com o mesmo id.
    now += 11 * 60 * 1000;
    const recreated = await cache.getOrCreate(
      params({ appSessionId: "app-a" }),
    );
    assertEquals(recreated?.hit, false);

    // A entrada de app-b permanece intacta (hit).
    const stillCached = await cache.getOrCreate(
      params({ appSessionId: "app-b" }),
    );
    assertEquals(stillCached?.hit, true);
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
