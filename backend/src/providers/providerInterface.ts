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

export interface AIProvider {
  generateContentStream(
    prompt: string,
    options?: AIRequestOptions,
  ): AsyncGenerator<string, void, unknown>;
  // Retorna (via `return`, não `yield`) quantos tokens do prefixo vieram do
  // cache de prompt no provedor — só verificável depois que o stream inteiro
  // é consumido. `0`/`void` quando o provedor não suporta cache ou não
  // houve hit. Número real (não boolean) pra dar pra medir economia de
  // verdade, não só "teve cache: sim/não".
  generateChatStream(
    prompt: string,
    history: any[],
    options?: AIRequestOptions,
  ): AsyncGenerator<string, number | void, unknown>;
  generateStructuredContent(
    prompt: string,
    schema: object,
    options?: AIRequestOptions,
  ): Promise<string>;
}
