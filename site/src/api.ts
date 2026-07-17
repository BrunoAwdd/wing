const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3005";

export class SignupApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
  ) {
    super(message);
    this.name = "SignupApiError";
  }
}

const GENERIC_ERROR =
  "Não foi possível concluir a solicitação agora. Tente novamente em instantes.";

async function postJson(
  path: string,
  body: unknown,
  token?: string,
): Promise<Response> {
  try {
    return await fetch(`${API_BASE_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new SignupApiError(GENERIC_ERROR, "network_error");
  }
}

export async function requestMagicLinkCode(email: string): Promise<void> {
  const response = await postJson("/api/v1/auth/magic-link/request", { email });

  if (response.status === 202) return;

  if (response.status === 429) {
    throw new SignupApiError(
      "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
      "rate_limited",
    );
  }

  throw new SignupApiError(GENERIC_ERROR, "request_failed");
}

export interface AuthenticatedUser {
  email: string;
  displayName: string | null;
  plan: string;
}

export interface AuthSession {
  token: string;
  expiresAt: string;
  refreshToken: string;
  refreshTokenExpiresAt: string;
  user: AuthenticatedUser;
}

export async function verifyMagicLinkCode(
  email: string,
  code: string,
): Promise<AuthSession> {
  const response = await postJson("/api/v1/auth/magic-link/verify", { email, code });

  if (response.status === 201) {
    return (await response.json()) as AuthSession;
  }

  if (response.status === 401) {
    throw new SignupApiError("Código inválido ou expirado.", "invalid_code");
  }

  if (response.status === 429) {
    throw new SignupApiError(
      "Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.",
      "rate_limited",
    );
  }

  throw new SignupApiError(GENERIC_ERROR, "verify_failed");
}

export type PayablePlan = "basic" | "pro";

export async function createCheckoutSession(
  plan: PayablePlan,
  token: string,
): Promise<string> {
  const response = await postJson("/api/v1/billing/checkout", { plan }, token);

  if (response.status === 200) {
    const body = (await response.json()) as { url: string };
    return body.url;
  }

  if (response.status === 401) {
    throw new SignupApiError(
      "Sua sessão expirou. Entre novamente para assinar.",
      "session_expired",
    );
  }

  throw new SignupApiError(
    "Não foi possível iniciar o pagamento agora. Tente novamente em instantes.",
    "checkout_failed",
  );
}
