import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { findMissingRequiredEnv } from "./requiredEnv.ts";

function fakeEnv(vars: Record<string, string>) {
  return { get: (name: string) => vars[name] };
}

Deno.test("requiredEnv: sem nenhuma variável, reporta todas como ausentes", () => {
  const missing = findMissingRequiredEnv(fakeEnv({}));
  assertEquals(missing.length > 0, true);
  assertEquals(missing.includes("STRIPE_SECRET_KEY"), true);
  assertEquals(missing.includes("SUPABASE_URL"), true);
  assertEquals(missing.includes("SUPABASE_PUBLISHABLE_KEY"), true);
});

Deno.test("requiredEnv: com todas as variáveis obrigatórias, não reporta nenhuma ausente", () => {
  const complete = fakeEnv({
    GEMINI_API_KEY: "x",
    JWT_SECRET: "x".repeat(32),
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "sb_publishable_test",
    SUPABASE_SECRET_KEY: "sb_secret_test",
    CORS_ALLOWED_ORIGINS: "https://robbie.awdd.com.br",
    STRIPE_SECRET_KEY: "x",
    STRIPE_WEBHOOK_SECRET: "x",
    STRIPE_PRICE_BASIC_MONTHLY: "x",
    STRIPE_PRICE_BASIC_YEARLY: "x",
    STRIPE_PRICE_PRO_MONTHLY: "x",
    STRIPE_PRICE_PRO_YEARLY: "x",
    STRIPE_SUCCESS_URL: "https://robbie.awdd.com.br/success",
    STRIPE_CANCEL_URL: "https://robbie.awdd.com.br/cancel",
    STRIPE_PORTAL_RETURN_URL: "https://robbie.awdd.com.br/account",
  });
  assertEquals(findMissingRequiredEnv(complete), []);
});

Deno.test("requiredEnv: reporta parcialmente quando só algumas faltam", () => {
  const partial = fakeEnv({
    GEMINI_API_KEY: "x",
    JWT_SECRET: "x".repeat(32),
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_test",
    CORS_ALLOWED_ORIGINS: "https://robbie.awdd.com.br",
  });
  assertEquals(findMissingRequiredEnv(partial), [
    "SUPABASE_PUBLISHABLE_KEY",
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_PRICE_BASIC_MONTHLY",
    "STRIPE_PRICE_BASIC_YEARLY",
    "STRIPE_PRICE_PRO_MONTHLY",
    "STRIPE_PRICE_PRO_YEARLY",
    "STRIPE_SUCCESS_URL",
    "STRIPE_CANCEL_URL",
    "STRIPE_PORTAL_RETURN_URL",
  ]);
});
