import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { supabase } from "./supabaseClient.ts";

// Teste de integração real contra o Postgres local (via PostgREST) — não
// mockado. Confirma que a função SQL increment_usage_and_check_limit
// (RFC 015 §11, migration 20260713_billing_schema_updates.sql) checa e
// incrementa a cota atomicamente, sem contar a tentativa que estoura o
// limite. Requer o stack Supabase local rodando (at-payments-supabase-docker)
// — não roda por padrão em `deno task test` pra não quebrar CI quando a
// infra local está fora do ar; ativar com WING_RUN_DB_INTEGRATION_TESTS=true.
const TEST_ACCOUNT_ID = "11111111-1111-1111-1111-111111111111";
const TEST_YYYYMM = 209912; // mês fictício distante, isolado de dados reais

Deno.test({
  name:
    "RPC increment_usage_and_check_limit: bloqueia acima do limite sem contar a tentativa excedente",
  ignore: Deno.env.get("WING_RUN_DB_INTEGRATION_TESTS") !== "true",
  fn: async () => {
    await supabase
      .from("accounts")
      .upsert({ id: TEST_ACCOUNT_ID, email: "rpc-integration-test@example.com" });
    await supabase
      .from("usage_monthly")
      .delete()
      .eq("account_id", TEST_ACCOUNT_ID)
      .eq("yyyymm", TEST_YYYYMM);

    const call = (limit: number | null) =>
      supabase.rpc("increment_usage_and_check_limit", {
        p_account_id: TEST_ACCOUNT_ID,
        p_yyyymm: TEST_YYYYMM,
        p_tokens: 10,
        p_limit: limit,
      });

    const first = await call(2);
    const second = await call(2);
    const third = await call(2);
    const fourth = await call(2);

    assertEquals(first.error, null);
    assertEquals(first.data?.[0], { requests_count: 1, allowed: true });
    assertEquals(second.data?.[0], { requests_count: 2, allowed: true });
    assertEquals(third.data?.[0], { requests_count: 2, allowed: false });
    assertEquals(fourth.data?.[0], { requests_count: 2, allowed: false });

    const unlimited = await call(null);
    assertEquals(unlimited.data?.[0], { requests_count: 3, allowed: true });

    await supabase
      .from("usage_monthly")
      .delete()
      .eq("account_id", TEST_ACCOUNT_ID)
      .eq("yyyymm", TEST_YYYYMM);
    await supabase.from("accounts").delete().eq("id", TEST_ACCOUNT_ID);
  },
});
