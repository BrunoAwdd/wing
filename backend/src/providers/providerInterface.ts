export interface AIRequestOptions {
  model?: string;
  temperature?: number;
  entitlement?: string;
  systemInstruction?: string;
}

export interface AIProvider {
  generateContentStream(
    prompt: string,
    options?: AIRequestOptions
  ): AsyncGenerator<string, void, unknown>;
  generateChatStream(
    prompt: string,
    history: any[],
    options?: AIRequestOptions
  ): AsyncGenerator<string, void, unknown>;
}
