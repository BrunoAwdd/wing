import { GoogleAICacheManager } from "../deps.ts";

// M4.5: cache de prompt no provedor pro prefixo estável (instruções +
// documento) do chat "Fale com o documento" — sem isso, cada mensagem
// reenvia o documento inteiro pro Gemini, mesmo quando ele não mudou desde
// a última pergunta. Isolado por conta, documento, modelo, versão do prompt
// e — desde o M4.6 — pela app session (instância aberta do Word): qualquer
// mudança em um desses gera uma chave nova, então o cache antigo nunca é
// reaproveitado incorretamente (invalidação por construção, sem precisar
// rastrear "o que mudou"). Incluir a app session significa que duas
// instâncias abertas do mesmo documento não compartilham o mesmo cache
// remoto — cada uma paga o custo do próprio prefixo na primeira mensagem,
// mas nenhum estado de execução atravessa instâncias.
//
// A chamada real ao GoogleAICacheManager é best-effort: documentos pequenos
// demais pra qualificar pro cache do Gemini (ou qualquer outra falha da
// API) resultam em `null` — quem chama simplesmente segue sem cache, nunca
// quebra a conversa por causa disso.
export const PROMPT_VERSION = "v1";

export interface CachedPrefix {
  name: string;
  expiresAt: number;
  // Só pra rastreio/observabilidade (logs, inspeção em teste) — não é
  // credencial nem dado de autenticação, apenas identifica qual "janela"
  // (app session) criou esta entrada do cache.
  appSessionId: string;
}

export interface CacheClient {
  create(params: {
    model: string;
    documentText: string;
    systemInstruction: string;
    ttlSeconds: number;
  }): Promise<{ name: string } | null>;
  // M4.7: encerrar a app session dona de um cache precisa parar de pagar
  // por ele no provedor imediatamente, em vez de esperar o TTL vencer
  // sozinho — best-effort (mesmo padrão de `create`), quem chama nunca
  // trata falha de delete como erro fatal.
  delete(name: string): Promise<void>;
}

const hashHex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
};

export const hashDocumentKey = async (
  accountId: string,
  documentText: string,
  model: string,
  appSessionId: string,
  promptVersion: string = PROMPT_VERSION,
  systemInstruction: string = "",
): Promise<string> =>
  `${accountId}:${await hashHex(documentText)}:${await hashHex(
    systemInstruction,
  )}:${model}:${promptVersion}:${appSessionId}`;

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");

// Lazy, igual ao stripeClient em stripeService.ts: instanciar no import
// falharia (ou apontaria pra uma chave errada) em qualquer ambiente sem
// GEMINI_API_KEY configurado, inclusive testes — só é necessário no
// primeiro uso real.
let cacheManager: GoogleAICacheManager | null = null;
const getCacheManager = (): GoogleAICacheManager => {
  if (!cacheManager) {
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY não configurado.");
    cacheManager = new GoogleAICacheManager(GEMINI_API_KEY);
  }
  return cacheManager;
};

export const realCacheClient: CacheClient = {
  create: async ({ model, documentText, systemInstruction, ttlSeconds }) => {
    try {
      // O SDK do cache manager espera o nome totalmente qualificado
      // ("models/gemini-..."), diferente de getGenerativeModel (que aceita
      // o nome nu) — normaliza defensivamente. `contents` carrega o
      // documento (a parte grande e estável); `systemInstruction` fica com
      // a framing curta do papel do assistente.
      const qualifiedModel = model.startsWith("models/")
        ? model
        : `models/${model}`;
      const result = await getCacheManager().create({
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
  },
  delete: async (name) => {
    await getCacheManager().delete(name);
  },
};

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

// M4.7: janela de tolerância pra uma `create()` em voo terminar depois que
// a app session já encerrou — best-effort e generosa de propósito (uma
// chamada real ao Gemini não deveria levar nem perto disso), só existe pra
// nunca deixar um tombstone crescendo pra sempre no mapa.
const CREATE_RACE_TOMBSTONE_MS = 10 * 60 * 1000;

// Fábrica (não singleton no módulo) pra permitir um mapa isolado por teste
// e injeção do client — mesmo padrão de DI usado nos routers deste projeto.
export const createGeminiContextCache = (
  dependencies: GeminiContextCacheDependencies = defaultDependencies,
) => {
  const cache = new Map<string, CachedPrefix>();
  const sleep = dependencies.sleep ?? defaultDependencies.sleep!;
  const createTimeoutMs = dependencies.createTimeoutMs ??
    defaultDependencies.createTimeoutMs!;
  // M4.7: app sessions que já terminaram, mas podem ainda ter um
  // `client.create()` em voo (iniciado antes do encerramento) — sem isto,
  // `invalidateAppSession()` só limpa o que já está no mapa NO MOMENTO em
  // que roda; uma criação que termina DEPOIS insere uma entrada nova pra
  // uma sessão que já não existe mais, e essa entrada nunca é limpa (fica
  // paga no Gemini até o próprio TTL do cache vencer sozinho).
  const endedAppSessions = new Map<string, number>();

  const pruneEndedAppSessions = (now: number) => {
    for (const [id, expiresAt] of endedAppSessions) {
      if (expiresAt <= now) endedAppSessions.delete(id);
    }
  };

  const deleteRemote = async (name: string, remoteExpiresAt: number) => {
    const delays = [0, 1_000, 5_000, 30_000];
    for (const delay of delays) {
      if (delay > 0) await sleep(delay);
      try {
        await dependencies.client.delete(name);
        return;
      } catch (error) {
        if (
          dependencies.now() + (delays[delays.indexOf(delay) + 1] ?? 0) >=
            remoteExpiresAt
        ) {
          console.error(
            "[GeminiContextCache] Falha ao excluir cache remoto antes do TTL:",
            error,
          );
          return;
        }
      }
    }
  };

  return {
    // Retorna o nome do conteúdo em cache (existente ou recém-criado), ou
    // `null` se não foi possível cachear (documento pequeno demais, erro da
    // API etc.) — nesses casos, quem chama deve seguir sem cache.
    getOrCreate: async (params: {
      accountId: string;
      documentText: string;
      model: string;
      systemInstruction: string;
      ttlSeconds: number;
      appSessionId: string;
      promptVersion?: string;
    }): Promise<{ name: string; hit: boolean } | null> => {
      const key = await hashDocumentKey(
        params.accountId,
        params.documentText,
        params.model,
        params.appSessionId,
        params.promptVersion,
        params.systemInstruction,
      );
      const now = dependencies.now();
      const existing = cache.get(key);
      if (existing && existing.expiresAt > now) {
        return { name: existing.name, hit: true };
      }

      const remoteExpiresAt = now + params.ttlSeconds * 1000;
      const createPromise = dependencies.client.create({
        model: params.model,
        documentText: params.documentText,
        systemInstruction: params.systemInstruction,
        ttlSeconds: params.ttlSeconds,
      });
      let timeoutId: number | undefined;
      const timedOut = Symbol("cache-create-timeout");
      const timeoutPromise = new Promise<typeof timedOut>((resolve) => {
        timeoutId = setTimeout(() => resolve(timedOut), createTimeoutMs);
      });
      const createResult = await Promise.race([createPromise, timeoutPromise]);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
      if (createResult === timedOut) {
        // O SDK não oferece abort para esta operação. Se ela concluir
        // depois do timeout, a continuação ainda elimina o cache criado.
        void createPromise.then((late) => {
          if (late) return deleteRemote(late.name, remoteExpiresAt);
        }).catch(() => {});
        return null;
      }
      const created = createResult;
      if (!created) return null;

      // M4.7: a app session pode ter terminado ENQUANTO `create()` estava
      // em voo — `invalidateAppSession()` já rodou e não achou nada pra
      // limpar no mapa (esta entrada nem existia ainda). Sem esta checagem,
      // a entrada seria inserida normalmente e ficaria paga no Gemini até o
      // próprio TTL vencer sozinho, mesmo com a sessão dona dela já morta.
      const nowAfterCreate = dependencies.now();
      pruneEndedAppSessions(nowAfterCreate);
      if (endedAppSessions.has(params.appSessionId)) {
        await deleteRemote(created.name, remoteExpiresAt);
        return null;
      }

      cache.set(key, {
        name: created.name,
        expiresAt: remoteExpiresAt,
        appSessionId: params.appSessionId,
      });
      return { name: created.name, hit: false };
    },

    // M4.7: chamado quando uma app session termina (TTL, teto absoluto ou
    // fechamento explícito) — sem isso, o cache remoto de uma instância
    // encerrada continuava armazenado (e potencialmente cobrado pelo
    // provedor) até o próprio TTL do cache vencer, mesmo que ninguém mais
    // pudesse reutilizá-lo (a chave já inclui `appSessionId`, então nenhuma
    // outra sessão bateria nessa entrada de qualquer forma). Best-effort e
    // fire-and-forget do ponto de vista de quem chama. Também marca um
    // tombstone (ver `endedAppSessions` acima) pra cobrir uma `create()`
    // desta mesma sessão que ainda esteja em voo neste instante.
    invalidateAppSession: async (appSessionId: string): Promise<void> => {
      const now = dependencies.now();
      endedAppSessions.set(appSessionId, now + CREATE_RACE_TOMBSTONE_MS);
      pruneEndedAppSessions(now);

      const toDelete = Array.from(cache.entries()).filter(
        ([, entry]) => entry.appSessionId === appSessionId,
      );
      for (const [key, entry] of toDelete) {
        cache.delete(key);
        await deleteRemote(entry.name, entry.expiresAt);
      }
    },

    // Exposto só pra teste/inspeção — o mapa em si já se auto-invalida por
    // TTL e por chave (documento/modelo/versão diferentes = chave nova).
    size: () => cache.size,
  };
};

export const geminiContextCache = createGeminiContextCache();
