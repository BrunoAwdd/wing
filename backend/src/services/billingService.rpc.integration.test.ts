import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { supabase } from "./supabaseClient.ts";

// Teste de integração real contra o Postgres local (via PostgREST) — não
// mockado. Confirma que reserva e liquidação de créditos são atômicas e
// idempotentes. Requer o stack Supabase local rodando (at-payments-supabase-docker)
// — não roda por padrão em `deno task test` pra não quebrar CI quando a
// infra local está fora do ar; ativar com WING_RUN_DB_INTEGRATION_TESTS=true.
const TEST_ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEST_YYYYMM = 209912; // mês fictício distante, isolado de dados reais

Deno.test({
  name:
    "RPC credit quota: reserva, bloqueia excedente e liquida de forma idempotente",
  ignore: Deno.env.get("WING_RUN_DB_INTEGRATION_TESTS") !== "true",
  fn: async () => {
    await supabase
      .from("accounts")
      .upsert({
        id: TEST_ACCOUNT_ID,
        email: "rpc-integration-test@example.com",
      });
    await supabase
      .from("usage_monthly")
      .delete()
      .eq("account_id", TEST_ACCOUNT_ID)
      .eq("yyyymm", TEST_YYYYMM);

    const reserve = (id: string, credits: number, limit: number | null) =>
      supabase.rpc("reserve_usage_credits", {
        p_reservation_id: id,
        p_account_id: TEST_ACCOUNT_ID,
        p_yyyymm: TEST_YYYYMM,
        p_model: "gemini-flash-3.5",
        p_credits: credits,
        p_limit: limit,
      });

    const firstId = "11111111-1111-1111-1111-111111111101";
    const secondId = "11111111-1111-1111-1111-111111111102";
    const first = await reserve(firstId, 60, 100);
    const blocked = await reserve(secondId, 50, 100);

    assertEquals(first.error, null);
    assertEquals(first.data?.[0], { credits_used: 60, allowed: true });
    assertEquals(blocked.data?.[0], { credits_used: 60, allowed: false });

    const settled = await supabase.rpc("settle_usage_credits", {
      p_reservation_id: firstId,
      p_actual_credits: 25,
      p_input_tokens: 1_000,
      p_output_tokens: 500,
    });
    const settledAgain = await supabase.rpc("settle_usage_credits", {
      p_reservation_id: firstId,
      p_actual_credits: 99,
      p_input_tokens: 9_000,
      p_output_tokens: 9_000,
    });
    assertEquals(settled.data, 25);
    assertEquals(settledAgain.data, 25);

    const second = await reserve(secondId, 50, 100);
    assertEquals(second.data?.[0], { credits_used: 75, allowed: true });

    await supabase
      .from("usage_credit_reservations")
      .delete()
      .eq("account_id", TEST_ACCOUNT_ID)
      .eq("yyyymm", TEST_YYYYMM);
    await supabase
      .from("usage_monthly")
      .delete()
      .eq("account_id", TEST_ACCOUNT_ID)
      .eq("yyyymm", TEST_YYYYMM);

    const concurrent = await Promise.all([
      reserve("11111111-1111-1111-1111-111111111103", 60, 100),
      reserve("11111111-1111-1111-1111-111111111104", 60, 100),
    ]);
    assertEquals(
      concurrent.map((result) => result.data?.[0]?.allowed).sort(),
      [false, true],
    );

    await supabase
      .from("usage_credit_reservations")
      .delete()
      .eq("account_id", TEST_ACCOUNT_ID)
      .eq("yyyymm", TEST_YYYYMM);
    await supabase
      .from("usage_monthly")
      .delete()
      .eq("account_id", TEST_ACCOUNT_ID)
      .eq("yyyymm", TEST_YYYYMM);
    await supabase.from("accounts").delete().eq("id", TEST_ACCOUNT_ID);
  },
});
