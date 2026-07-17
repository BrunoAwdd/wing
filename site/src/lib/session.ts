import type { AuthSession } from "../api";

const STORAGE_KEY = "wing_session";

export interface StoredSession {
  token: string;
  refreshToken: string;
  user: AuthSession["user"];
}

export function saveSession(session: AuthSession): void {
  const stored: StoredSession = {
    token: session.token,
    refreshToken: session.refreshToken,
    user: session.user,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function getSession(): StoredSession | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
