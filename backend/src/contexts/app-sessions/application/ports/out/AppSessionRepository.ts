import { AppSession } from "../../../domain/AppSession.ts";

export interface AppSessionRepository {
  save(session: AppSession): void;
  findById(id: string): AppSession | null;
  delete(id: string): void;
}
