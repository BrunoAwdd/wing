import { geminiProvider } from "../providers/geminiProvider";
import { AIProvider } from "../providers/providerInterface";
import { withRetry } from "../providers/withRetry";

// Wrap the chosen provider with the retry logic.
const retryingProvider = withRetry(geminiProvider);

// In the future, you can use an environment variable to decide which provider to use.
// const activeProvider: AIProvider = process.env.AI_PROVIDER === 'azure' ? withRetry(azureProvider) : retryingProvider;
const activeProvider: AIProvider = retryingProvider;

/**
 * Gera conteúdo de texto em stream usando o provedor de IA ativo.
 * @param prompt O prompt a ser enviado para a IA.
 * @param entitlement O nível de licença do usuário (ex: 'Free', 'Paid').
 * @returns Um gerador assíncrono que produz os pedaços de texto.
 */
export const generateTextStream = (prompt: string, entitlement: string): AsyncGenerator<string, void, unknown> => {
  return activeProvider.generateContentStream(prompt, entitlement);
};