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

export const generateTextStream = (
  prompt: string,
  optionsOrEntitlement: string | AIRequestOptions
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
  options?: AIRequestOptions
): AsyncGenerator<string, CacheUsage | void, unknown> => {
  const provider = getProviderForModel(options?.model);
  return provider.generateChatStream(prompt, history, options);
};

export const generateStructuredJson = async (
  prompt: string,
  schema: object,
  options?: AIRequestOptions
): Promise<string> => {
  const provider = getProviderForModel(options?.model);
  return provider.generateStructuredContent(prompt, schema, options);
};
