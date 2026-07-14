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
};

export interface GeminiContextCacheDependencies {
  client: CacheClient;
  now: () => number;
}

const defaultDependencies: GeminiContextCacheDependencies = {
  client: realCacheClient,
  now: Date.now,
};

// Fábrica (não singleton no módulo) pra permitir um mapa isolado por teste
// e injeção do client — mesmo padrão de DI usado nos routers deste projeto.
export const createGeminiContextCache = (
  dependencies: GeminiContextCacheDependencies = defaultDependencies,
) => {
  const cache = new Map<string, CachedPrefix>();

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

      const created = await dependencies.client.create({
        model: params.model,
        documentText: params.documentText,
        systemInstruction: params.systemInstruction,
        ttlSeconds: params.ttlSeconds,
      });
      if (!created) return null;

      cache.set(key, {
        name: created.name,
        expiresAt: now + params.ttlSeconds * 1000,
        appSessionId: params.appSessionId,
      });
      return { name: created.name, hit: false };
    },

    // Exposto só pra teste/inspeção — o mapa em si já se auto-invalida por
    // TTL e por chave (documento/modelo/versão diferentes = chave nova).
    size: () => cache.size,
  };
};

export const geminiContextCache = createGeminiContextCache();
