import { AIProvider } from "./providerInterface.ts";

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

/**
 * Wraps an AIProvider with a retry mechanism for the generateContentStream method.
 * If the stream fails, it will retry with exponential backoff.
 *
 * @param provider The AIProvider to wrap.
 * @returns An AIProvider with retry logic.
 */
export function withRetry(provider: AIProvider): AIProvider {
  return {
    async *generateContentStream(
      prompt: string,
      entitlement: string
    ): AsyncGenerator<string, void, unknown> {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          // Each attempt requires a new generator
          const stream = provider.generateContentStream(prompt, entitlement);

          // Yield all chunks from the stream
          for await (const chunk of stream) {
            yield chunk;
          }

          // If the stream completes without error, we are done.
          return;
        } catch (error: any) {
          lastError = error;
          console.warn(
            `Attempt ${attempt + 1} of ${
              MAX_RETRIES + 1
            } failed for generateContentStream: ${error.message}`
          );

          if (attempt < MAX_RETRIES) {
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      // If all retries fail, throw the last recorded error.
      throw new Error(
        `AI content generation failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError?.message}`
      );
    },

    async *generateChatStream(prompt: string, history: any[]): AsyncGenerator<string, void, unknown> {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
          const stream = provider.generateChatStream(prompt, history);
          for await (const chunk of stream) {
            yield chunk;
          }
          return;
        } catch (error: any) {
          lastError = error;
          console.warn(`Attempt ${attempt + 1} of ${MAX_RETRIES + 1} failed for generateChatStream: ${error.message}`);

          if (attempt < MAX_RETRIES) {
            const delay = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
            console.log(`Retrying in ${delay}ms...`);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      throw new Error(`AI chat generation failed after ${MAX_RETRIES + 1} attempts. Last error: ${lastError?.message}`);
    },
  };
}
