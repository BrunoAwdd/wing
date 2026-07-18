import { ChatHistoryEntry } from "../../cache/domain/ChatHistoryCompactor.ts";

export interface ChatLimits {
  maxDocumentChars: number;
  maxMessageChars: number;
  maxMessages: number;
  sessionTtlMs: number;
}

export class ChatSession {
  public history: ChatHistoryEntry[];
  public inFlight: boolean;
  public messageCount: number;

  constructor(
    public readonly id: string,
    public readonly accountId: string,
    public readonly appSessionId: string,
    public readonly documentId: string,
    public readonly documentText: string,
    public readonly createdAt: number,
    public readonly expiresAt: number,
    initialHistory: ChatHistoryEntry[],
  ) {
    this.history = initialHistory;
    this.inFlight = false;
    this.messageCount = 0;
  }

  isExpired(now: number): boolean {
    return this.expiresAt <= now;
  }

  canAcceptMessage(maxMessages: number): boolean {
    return !this.inFlight && this.messageCount < maxMessages;
  }
}
