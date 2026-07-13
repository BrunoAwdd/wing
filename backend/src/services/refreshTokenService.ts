import { supabase } from "./supabaseClient.ts";

const REFRESH_TOKEN_TTL_SECONDS = Number(
  Deno.env.get("WING_REFRESH_TOKEN_TTL_SECONDS") || String(30 * 24 * 60 * 60), // 30 dias
);

export class RefreshTokenError extends Error {
  constructor(message = "Sessão expirada. Faça login novamente.") {
    super(message);
    this.name = "RefreshTokenError";
  }
}

// Só o hash é persistido — nunca o token bruto (mesmo raciocínio de
// armazenar senha com hash: um vazamento do banco não expõe tokens usáveis).
const hashToken = async (token: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return Array.from(new Uint8Array(digest)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
};

export const refreshTokenService = {
  issue: async (
    accountId: string,
  ): Promise<{ token: string; expiresAt: string }> => {
    const token = crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");
    const tokenHash = await hashToken(token);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000)
      .toISOString();

    const { error } = await supabase.from("refresh_tokens").insert({
      account_id: accountId,
      token_hash: tokenHash,
      expires_at: expiresAt,
    });
    if (error) throw error;

    return { token, expiresAt };
  },

  // Valida e revoga o token num único passo (rotação): quem chamou deve
  // emitir um novo refresh token pra substituir este na resposta. Se um
  // token vazado for reusado por um atacante, o uso legítimo seguinte já o
  // encontra revogado e falha — sinal de comprometimento, não só proteção.
  consume: async (rawToken: string): Promise<string> => {
    const tokenHash = await hashToken(rawToken);
    const { data, error } = await supabase
      .from("refresh_tokens")
      .select("id, account_id, expires_at, revoked_at")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (error) throw error;
    if (
      !data || data.revoked_at ||
      new Date(data.expires_at).getTime() <= Date.now()
    ) {
      throw new RefreshTokenError();
    }

    const { error: revokeError } = await supabase
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id);
    if (revokeError) throw revokeError;

    return data.account_id;
  },

  // Logout explícito de um dispositivo — não afeta outros refresh tokens da
  // mesma conta (ex: Word aberto em outra máquina).
  revoke: async (rawToken: string): Promise<void> => {
    const tokenHash = await hashToken(rawToken);
    const { error } = await supabase
      .from("refresh_tokens")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", tokenHash)
      .is("revoked_at", null);
    if (error) throw error;
  },
};
