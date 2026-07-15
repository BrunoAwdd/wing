import { ChatSession } from "../../../domain/ChatSession.ts";

export interface ChatSessionRepository {
  save(session: ChatSession): void;
  get(sessionId: string): ChatSession | undefined;
  delete(sessionId: string): void;
  removeExpired(now: number): void;
  scheduleExpiration(sessionId: string, delay: number, onExpired: () => void): void;
  cancelExpiration(sessionId: string): void;
}
