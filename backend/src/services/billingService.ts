import { supabase } from "./supabaseClient.ts";
import { track } from "./telemetry.ts";
import { stripeService, type StripeSubscription } from "./stripeService.ts";
import type { MicrosoftIdentity } from "./microsoftIdentityService.ts";

export interface Account {
  id: string;
  email: string;
  display_name?: string | null;
  microsoft_tenant_id?: string | null;
  microsoft_object_id?: string | null;
  stripe_customer_id?: string | null;
  created_at: string;
}

// União completa dos status que a Stripe pode enviar (RFC 015 §8) — só
// "trialing"/"active" contam como Pro em getEntitlement, o resto é Free.
export interface Subscription {
  id: string;
  account_id: string;
  external_subscription_id: string;
  provider: "stripe" | "microsoft";
  plan: "free" | "pro" | "team" | "enterprise";
  status:
    | "trialing"
    | "active"
    | "past_due"
    | "canceled"
    | "incomplete"
    | "incomplete_expired"
    | "unpaid"
    | "paused";
  current_period_end: string;
}

export const billingService = {
  // --- Accounts ---
  getOrCreateMicrosoftAccount: async (
    identity: MicrosoftIdentity,
  ): Promise<Account> => {
    const email = identity.email.trim().toLowerCase();
    const { data: existing, error: identityLookupError } = await supabase
      .from("accounts")
      .select("*")
      .eq("microsoft_tenant_id", identity.tenantId)
      .eq("microsoft_object_id", identity.objectId)
      .maybeSingle();

    if (identityLookupError) throw identityLookupError;

    if (existing) {
      const updates: Record<string, string> = {};
      if (existing.email !== email) updates.email = email;
      if (
        identity.displayName && existing.display_name !== identity.displayName
      ) {
        updates.display_name = identity.displayName;
      }

      if (Object.keys(updates).length === 0) return existing;

      const { data: updated, error } = await supabase
        .from("accounts")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return updated;
    }

    const { data: newAccount, error } = await supabase
      .from("accounts")
      .insert({
        email,
        display_name: identity.displayName || null,
        microsoft_tenant_id: identity.tenantId,
        microsoft_object_id: identity.objectId,
      })
      .select()
      .single();

    if (error) throw error;
    return newAccount;
  },

  // Conta de login por e-mail (magic link / Supabase Auth) — não toca nos
  // campos microsoft_tenant_id/microsoft_object_id, que continuam nulos.
  getOrCreateAccountByEmail: async (rawEmail: string): Promise<Account> => {
    const email = rawEmail.trim().toLowerCase();
    const { data: existing, error: lookupError } = await supabase
      .from("accounts")
      .select("*")
      .eq("email", email)
      .maybeSingle();

    if (lookupError) throw lookupError;
    if (existing) return existing;

    const { data: newAccount, error } = await supabase
      .from("accounts")
      .insert({ email })
      .select()
      .single();

    if (error) throw error;
    return newAccount;
  },

  getAccount: async (accountId: string): Promise<Account> => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .single();

    if (error) throw error;
    return data;
  },

  // --- Subscriptions ---
  upsertSubscription: async (subscription: Partial<Subscription>) => {
    // Check if exists by external_subscription_id
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("external_subscription_id", subscription.external_subscription_id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("subscriptions")
        .update(subscription)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("subscriptions")
        .insert(subscription);
      if (error) throw error;
    }
  },

  getSubscription: async (accountId: string): Promise<Subscription | null> => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("account_id", accountId)
      .eq("status", "active") // Only active for now
      .single();

    if (error && error.code !== "PGRST116") throw error; // Ignore not found
    return data;
  },

  getEntitlement: async (
    accountId: string,
  ): Promise<{ plan: Subscription["plan"] | "free"; status: string }> => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("account_id", accountId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { plan: "free", status: "inactive" };

    const paidStatus = data.status === "active" || data.status === "trialing";
    const periodIsCurrent = typeof data.current_period_end === "string" &&
      new Date(data.current_period_end).getTime() > Date.now();

    if (!paidStatus || !periodIsCurrent) {
      return { plan: "free", status: data.status };
    }

    return { plan: data.plan, status: data.status };
  },

  // --- Usage ---
  // Incremento atômico via função SQL (RPC) — evita a condição de corrida de
  // um read-then-write em JS quando duas chamadas concorrem no mesmo mês.
  // `limit` é null pra planos pagos (sem teto); quando informado, a função só
  // incrementa se ainda houver cota — a tentativa que estouraria o limite não
  // é contada, senão retries/re-tentativas do usuário inflam requests_count
  // indefinidamente mesmo sem nunca terem chamado a IA.
  incrementUsage: async (
    accountId: string,
    tokens: number,
    limit: number | null,
  ): Promise<{ requestsCount: number; allowed: boolean }> => {
    const now = new Date();
    const yyyymm = parseInt(
      `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}`,
    );

    const { data, error } = await supabase.rpc("increment_usage_and_check_limit", {
      p_account_id: accountId,
      p_yyyymm: yyyymm,
      p_tokens: tokens,
      p_limit: limit,
    });
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as {
      requests_count: number;
      allowed: boolean;
    };

    if (row.allowed) {
      // RFC 014 §8: "consumo de cota Free" — só contagens, sem texto do documento.
      track(
        "usage_incremented",
        { yyyymm, requests_count: row.requests_count, tokens_used: tokens },
        accountId,
      );
    }

    return { requestsCount: row.requests_count, allowed: row.allowed };
  },

  // --- Stripe ---
  getOrCreateStripeCustomer: async (account: Account): Promise<string> => {
    if (account.stripe_customer_id) return account.stripe_customer_id;

    const customerId = await stripeService.createCustomer(account.email);
    const { error } = await supabase
      .from("accounts")
      .update({ stripe_customer_id: customerId })
      .eq("id", account.id);
    if (error) throw error;

    return customerId;
  },

  // Idempotência de webhook: a linha só existe se o evento ainda não foi
  // processado (id = Stripe event.id, PK). Insert falhando por conflito de
  // chave única == evento duplicado, sem precisar de "select antes".
  recordWebhookEventIfNew: async (event: {
    id: string;
    type: string;
    payload: unknown;
  }): Promise<boolean> => {
    const { error } = await supabase.from("webhook_events").insert({
      id: event.id,
      type: event.type,
      payload: event.payload,
    });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw error;
  },

  // Compensação: se o processamento do evento falhar depois do registro de
  // idempotência acima, a linha precisa sumir — senão o retry da Stripe
  // (mesmo event.id) bate no unique_violation e é descartado como duplicado,
  // e o evento nunca é reprocessado.
  removeWebhookEvent: async (eventId: string): Promise<void> => {
    const { error } = await supabase.from("webhook_events").delete().eq("id", eventId);
    if (error) throw error;
  },

  syncSubscriptionFromStripe: async (
    stripeSubscription: StripeSubscription,
    accountId: string,
  ): Promise<void> => {
    await billingService.upsertSubscription({
      account_id: accountId,
      external_subscription_id: stripeSubscription.id,
      provider: "stripe",
      plan: "pro",
      status: stripeSubscription.status as Subscription["status"],
      current_period_end: new Date(
        stripeSubscription.current_period_end * 1000,
      ).toISOString(),
    });
  },
};
