import { AppSession } from "../../domain/AppSession.ts";
import { AppSessionRepository } from "../../application/ports/out/AppSessionRepository.ts";

export class InMemoryAppSessionRepository implements AppSessionRepository {
  private readonly sessions = new Map<string, AppSession>();

  save(session: AppSession): void {
    this.sessions.set(session.id, session);
  }

  findById(id: string): AppSession | null {
    return this.sessions.get(id) || null;
  }

  delete(id: string): void {
    this.sessions.delete(id);
  }
}
