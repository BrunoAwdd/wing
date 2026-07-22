/* global Office, process, window */

const BACKEND_URL = process.env.BACKEND_URL || "";

export interface WingSessionUser {
  email: string;
  displayName: string | null;
  plan: "free" | "basic" | "pro" | "team" | "enterprise";
}

export interface WingSession {
  token: string;
  expiresAt: string;
  user: WingSessionUser;
  // Só presentes no fluxo de magic link (não no SSO Microsoft) — permitem
  // renovar a sessão silenciosamente sem pedir e-mail/código de novo.
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
}

export class WingAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WingAuthenticationError";
  }
}

const VALID_PLANS: WingSessionUser["plan"][] = ["free", "basic", "pro", "team", "enterprise"];

const readError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    return body.error || "Não foi possível iniciar a sessão Wing.";
  } catch {
    return "Não foi possível iniciar a sessão Wing.";
  }
};

const fetchBackend = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch {
    throw new WingAuthenticationError(
      "O servidor do Wing está indisponível. Tente novamente em instantes."
    );
  }
};

const getMicrosoftAccessToken = async (): Promise<string> => {
  if (typeof Office === "undefined" || !Office.auth?.getAccessToken) {
    throw new WingAuthenticationError(
      "O login do Microsoft 365 não está disponível neste ambiente."
    );
  }

  try {
    return await Office.auth.getAccessToken({
      allowSignInPrompt: true,
      allowConsentPrompt: true,
      forMSGraphAccess: false,
    });
  } catch {
    throw new WingAuthenticationError("Não foi possível autenticar sua conta Microsoft 365.");
  }
};

const parseSession = async (response: Response): Promise<WingSession> => {
  if (!response.ok) {
    throw new WingAuthenticationError(await readError(response));
  }

  const session = (await response.json()) as WingSession;
  if (
    !session.token ||
    !session.expiresAt ||
    !Number.isFinite(Date.parse(session.expiresAt)) ||
    !session.user?.email ||
    !VALID_PLANS.includes(session.user.plan)
  ) {
    throw new WingAuthenticationError("Resposta de autenticação inválida.");
  }

  return session;
};

export const createWingSession = async (): Promise<WingSession> => {
  const microsoftAccessToken = await getMicrosoftAccessToken();
  const response = await fetch(`${BACKEND_URL}/api/v1/auth/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ microsoftAccessToken }),
  });

  return parseSession(response);
};

export const closeWingSession = async (
  sessionToken: string,
  refreshToken?: string | null
): Promise<void> => {
  await fetch(`${BACKEND_URL}/api/v1/auth/session`, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      "Content-Type": "application/json",
    },
    // Revoga o refresh token deste dispositivo — sem isso, logout só some
    // localmente, mas o token de vida longa continua válido e podia ser
    // usado pra renovar a sessão de novo.
    body: JSON.stringify({ refreshToken: refreshToken || undefined }),
  }).catch(() => undefined);
};

export const requestMagicLinkCode = async (email: string): Promise<void> => {
  const response = await fetchBackend(`${BACKEND_URL}/api/v1/auth/magic-link/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });

  if (!response.ok) {
    throw new WingAuthenticationError(await readError(response));
  }
};

export const verifyMagicLinkCode = async (email: string, code: string): Promise<WingSession> => {
  const response = await fetchBackend(`${BACKEND_URL}/api/v1/auth/magic-link/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, code }),
  });

  return parseSession(response);
};

// Troca o refresh token (vida longa, persistido no dispositivo) por uma
// sessão Wing nova — é isto que permite reabrir o Word sem repetir o fluxo
// de e-mail/código. Lança WingAuthenticationError se o refresh token não
// existe mais, expirou ou já foi revogado (ex: logout em outro momento).
export const refreshSession = async (refreshToken: string): Promise<WingSession> => {
  const response = await fetchBackend(`${BACKEND_URL}/api/v1/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refreshToken }),
  });

  return parseSession(response);
};

// Persistência local do refresh token — sem isso, fechar/reabrir o Word
// sempre perde a sessão (só existia em memória) e força o fluxo completo de
// e-mail/código de novo. Só guarda o necessário pra tentar uma renovação
// silenciosa (refreshToken); o token de sessão curto em si não precisa
// sobreviver a um reload, já que será trocado por um novo de qualquer forma.
const STORAGE_KEY = "wing_refresh_token";

interface PersistedRefreshToken {
  refreshToken: string;
  refreshTokenExpiresAt: string;
}

export const persistRefreshToken = (session: WingSession): void => {
  if (!session.refreshToken || !session.refreshTokenExpiresAt) return;
  try {
    const payload: PersistedRefreshToken = {
      refreshToken: session.refreshToken,
      refreshTokenExpiresAt: session.refreshTokenExpiresAt,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, quota etc.) — degrada pra
    // login manual a cada abertura, sem quebrar o app.
  }
};

export const loadPersistedRefreshToken = (): string | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<PersistedRefreshToken>;
    if (!parsed.refreshToken || !parsed.refreshTokenExpiresAt) return null;
    if (Date.parse(parsed.refreshTokenExpiresAt) <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed.refreshToken;
  } catch {
    return null;
  }
};

export const clearPersistedRefreshToken = (): void => {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignora — nada pra limpar se localStorage já está inacessível.
  }
};
