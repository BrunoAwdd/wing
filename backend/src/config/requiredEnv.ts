// Validação agregada de secrets obrigatórios em produção. Precisa ser o
// primeiro import de src/index.ts: módulos como supabaseClient.ts e
// stripeService.ts já lançam erro se sua própria variável faltar, mas cada
// um pára o boot no primeiro problema encontrado. Rodar essa checagem antes
// de qualquer outro import reporta a lista completa de variáveis ausentes de
// uma vez, em vez de obrigar um ciclo de "corrigir uma, redeployar, achar a
// próxima".
const REQUIRED_IN_PRODUCTION = [
  "GEMINI_API_KEY",
  "JWT_SECRET",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SECRET_KEY",
  "CORS_ALLOWED_ORIGINS",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "STRIPE_PRICE_BASIC_MONTHLY",
  "STRIPE_PRICE_BASIC_YEARLY",
  "STRIPE_PRICE_PRO_MONTHLY",
  "STRIPE_PRICE_PRO_YEARLY",
  "STRIPE_SUCCESS_URL",
  "STRIPE_CANCEL_URL",
  "STRIPE_PORTAL_RETURN_URL",
];

export function findMissingRequiredEnv(
  env: { get(name: string): string | undefined },
): string[] {
  return REQUIRED_IN_PRODUCTION.filter((name) => !env.get(name));
}

export function validateRequiredEnv(
  isProduction: boolean,
  env: { get(name: string): string | undefined } = Deno.env,
): void {
  if (!isProduction) return;

  const missing = findMissingRequiredEnv(env);
  if (missing.length > 0) {
    console.error(
      `Boot abortado: variáveis de ambiente obrigatórias ausentes em produção: ${
        missing.join(", ")
      }`,
    );
    Deno.exit(1);
  }
}

validateRequiredEnv(Deno.env.get("NODE_ENV") === "production");
