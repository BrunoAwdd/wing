import { geminiProvider } from "../providers/geminiProvider.ts";
import { openaiProvider } from "../providers/openaiProvider.ts";
import { anthropicProvider } from "../providers/anthropicProvider.ts";
import {
  AIProvider,
  AIRequestOptions,
  CacheUsage,
} from "../providers/providerInterface.ts";
import { withRetry } from "../providers/withRetry.ts";

// Wrap providers with retry logic
const providers = {
  gemini: withRetry(geminiProvider),
  openai: withRetry(openaiProvider),
  anthropic: withRetry(anthropicProvider),
};

const getProviderForModel = (model?: string): AIProvider => {
  if (!model) return providers.gemini; // Default
  if (model.startsWith("gpt")) return providers.openai;
  if (model.startsWith("claude")) return providers.anthropic;
  return providers.gemini;
};

// Verifica se o provedor do modelo tem API key configurada, sem fazer
// nenhuma chamada de rede — OpenAI/Anthropic só falham de fato na primeira
// requisição real (o construtor apenas avisa via console.warn), então sem
// isto o único jeito de descobrir que falta chave é deixar a chamada
// quebrar. Gemini é obrigatório na inicialização do servidor (o provider
// lança na hora de construir se faltar), então sempre "disponível" aqui.
interface EnvironmentReader {
  get(name: string): string | undefined;
}

export const isProviderAvailable = (
  model?: string,
  environment: EnvironmentReader = Deno.env,
): boolean => {
  if (!model) return true;
  if (model.startsWith("gpt")) {
    return Boolean(environment.get("OPENAI_API_KEY"));
  }
  if (model.startsWith("claude")) {
    return Boolean(environment.get("ANTHROPIC_API_KEY"));
  }
  return true;
};

export const resolveAvailableModel = (
  model: string,
  fallbackModel: string,
  isProduction: boolean,
  isAvailable: (candidate: string) => boolean = isProviderAvailable,
): string =>
  !isProduction && !isAvailable(model) && isAvailable(fallbackModel)
    ? fallbackModel
    : model;

export const generateTextStream = (
  prompt: string,
  optionsOrEntitlement: string | AIRequestOptions,
): AsyncGenerator<string, void, unknown> => {
  let options: AIRequestOptions = {};
  if (typeof optionsOrEntitlement === "string") {
    options = { entitlement: optionsOrEntitlement };
  } else {
    options = optionsOrEntitlement;
  }

  const provider = getProviderForModel(options.model);
  return provider.generateContentStream(prompt, options);
};

export const generateChatStream = (
  prompt: string,
  history: any[],
  options?: AIRequestOptions,
): AsyncGenerator<string, CacheUsage | void, unknown> => {
  const provider = getProviderForModel(options?.model);
  return provider.generateChatStream(prompt, history, options);
};

export const generateStructuredJson = async (
  prompt: string,
  schema: object,
  options?: AIRequestOptions,
): Promise<string> => {
  const provider = getProviderForModel(options?.model);
  return provider.generateStructuredContent(prompt, schema, options);
};
