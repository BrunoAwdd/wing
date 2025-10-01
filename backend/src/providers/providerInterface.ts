export interface AIProvider {
  generateContentStream(prompt: string, entitlement: string): AsyncGenerator<string, void, unknown>;
}
