export interface AIRequestOptions {
  model?: string;
  temperature?: number;
  entitlement?: string;
  systemInstruction?: string;
  maxOutputTokens?: number;
  // M4.5: nome do conteúdo em cache no Gemini pro prefixo estável
  // (instruções + documento) — quando presente, o provedor deve usar o
  // cache em vez de reenviar `systemInstruction`. Específico do fluxo
  // explícito de cache do Gemini (GoogleAICacheManager).
  cachedContentName?: string;
  // M4.5: pede pro provedor marcar o prefixo estável como cacheável quando
  // o mecanismo de cache dele for implícito/automático (Anthropic exige
  // marcar `cache_control` no bloco; OpenAI cacheia automaticamente prefixos
  // estáveis >=1024 tokens, só precisa pedir os metadados de uso).
  enablePromptCache?: boolean;
}

// M4.7: "registrar separadamente input_tokens, cached_input_tokens e
// cache_write_tokens" — um número boolean-disfarçado não bastava pra medir
// economia real nem pra cobrar corretamente (leitura de cache tem desconto;
// escrita de cache é cobrada como entrada normal, não é "de graça"). Os
// três provedores normalizam pra este formato aditivo (não sobreposto):
// `cachedInputTokens` nunca inclui `cacheWriteTokens` e vice-versa. Gemini e
// OpenAI não têm um custo de "escrita" distinto no modelo de cache deles
// (cache automático/por referência, sem tarifa extra na primeira chamada),
// então sempre reportam `cacheWriteTokens: 0` — só a Anthropic tem esse
// conceito de verdade (`cache_creation_input_tokens`).
export interface CacheUsage {
  cachedInputTokens: number;
  cacheWriteTokens: number;
  // M4.7: contagem real de tokens de entrada reportada pelo próprio
  // provedor (inclui os tokens cacheados/gravados — é o total lógico, não
  // um extra por cima), quando disponível nos metadados de uso da chamada.
  // `undefined` quando o provedor não devolveu essa informação — quem
  // liquida a cobrança cai de volta pra `estimateTokens` (heurística por
  // tamanho de texto) nesse caso, nunca falha por causa disso.
  totalInputTokens?: number;
}

export interface AIProvider {
  generateContentStream(
    prompt: string,
    options?: AIRequestOptions,
  ): AsyncGenerator<string, void, unknown>;
  // Retorna (via `return`, não `yield`) a repartição real de tokens de
  // cache — só verificável depois que o stream inteiro é consumido.
  // `void` quando o provedor não suporta cache de prompt.
  generateChatStream(
    prompt: string,
    history: any[],
    options?: AIRequestOptions,
  ): AsyncGenerator<string, CacheUsage | void, unknown>;
  generateStructuredContent(
    prompt: string,
    schema: object,
    options?: AIRequestOptions,
  ): Promise<string>;
}
