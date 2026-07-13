/* global Office, process */

const BACKEND_URL = process.env.BACKEND_URL || "";

export interface WingSessionUser {
  email: string;
  displayName: string | null;
  plan: "free" | "pro" | "team" | "enterprise";
}

export interface WingSession {
  token: string;
  expiresAt: string;
  user: WingSessionUser;
}

export class WingAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WingAuthenticationError";
  }
}

const VALID_PLANS: WingSessionUser["plan"][] = ["free", "pro", "team", "enterprise"];

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

export const closeWingSession = async (sessionToken: string): Promise<void> => {
  await fetch(`${BACKEND_URL}/api/v1/auth/session`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${sessionToken}` },
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
