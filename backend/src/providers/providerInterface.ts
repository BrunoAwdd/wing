export interface AIRequestOptions {
  model?: string;
  temperature?: number;
  entitlement?: string;
  systemInstruction?: string;
  maxOutputTokens?: number;
}

export interface AIProvider {
  generateContentStream(
    prompt: string,
    options?: AIRequestOptions,
  ): AsyncGenerator<string, void, unknown>;
  generateChatStream(
    prompt: string,
    history: any[],
    options?: AIRequestOptions,
  ): AsyncGenerator<string, void, unknown>;
  generateStructuredContent(
    prompt: string,
    schema: object,
    options?: AIRequestOptions,
  ): Promise<string>;
}
