import { createClient } from "../deps.ts";

// Client dedicado a chamadas de Auth (GoTrue) — deliberadamente SEM
// `db.schema`, porque a API de Auth não passa pelo PostgREST/schema "wing"
// usado por supabaseClient.ts para as tabelas do produto.
const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set for Supabase Auth.",
  );
}

const supabaseAuth = createClient(supabaseUrl, supabaseKey);

export class MagicLinkValidationError extends Error {
  constructor(message = "Código inválido ou expirado.") {
    super(message);
    this.name = "MagicLinkValidationError";
  }
}

export const supabaseAuthService = {
  requestEmailCode: async (email: string): Promise<void> => {
    const { error } = await supabaseAuth.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      throw new MagicLinkValidationError(error.message);
    }
  },

  verifyEmailCode: async (
    email: string,
    code: string,
  ): Promise<{ email: string }> => {
    const { data, error } = await supabaseAuth.auth.verifyOtp({
      email,
      token: code,
      type: "email",
    });
    if (error || !data.user?.email) {
      throw new MagicLinkValidationError();
    }
    return { email: data.user.email };
  },
};
