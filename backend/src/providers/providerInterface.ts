export interface AIProvider {
  generateContentStream(prompt: string, entitlement: string): AsyncGenerator<string, void, unknown>;
  generateChatStream(prompt: string, history: any[]): AsyncGenerator<string, void, unknown>;
}
