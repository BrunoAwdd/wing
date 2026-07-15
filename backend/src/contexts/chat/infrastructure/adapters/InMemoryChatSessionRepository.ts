import { ChatSession } from "../../domain/ChatSession.ts";
import { ChatSessionRepository } from "../../application/ports/out/ChatSessionRepository.ts";

export class InMemoryChatSessionRepository implements ChatSessionRepository {
  private sessions = new Map<string, ChatSession>();
  private timeouts = new Map<string, number>();

  constructor(
    private readonly scheduleTimer: (cb: () => void, delay: number) => number,
    private readonly cancelTimer: (id: number) => void
  ) {}

  save(session: ChatSession): void {
    this.sessions.set(session.id, session);
  }

  get(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
    this.cancelExpiration(sessionId);
  }

  removeExpired(now: number): void {
    for (const [sessionId, session] of this.sessions) {
      if (session.isExpired(now)) {
        this.delete(sessionId);
      }
    }
  }

  scheduleExpiration(sessionId: string, delay: number, onExpired: () => void): void {
    const timeoutId = this.scheduleTimer(() => {
      this.sessions.delete(sessionId);
      this.timeouts.delete(sessionId);
      onExpired();
    }, delay);
    this.timeouts.set(sessionId, timeoutId);
  }

  cancelExpiration(sessionId: string): void {
    const timeoutId = this.timeouts.get(sessionId);
    if (timeoutId !== undefined) {
      this.cancelTimer(timeoutId);
      this.timeouts.delete(sessionId);
    }
  }
}
