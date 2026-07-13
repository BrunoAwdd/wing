import { supabase } from "./supabaseClient.ts";
import { track } from "./telemetry.ts";
import type { MicrosoftIdentity } from "./microsoftIdentityService.ts";

export interface Account {
  id: string;
  email: string;
  display_name?: string | null;
  microsoft_tenant_id?: string | null;
  microsoft_object_id?: string | null;
  stripe_customer_id?: string;
  created_at: string;
}

export interface Subscription {
  id: string;
  account_id: string;
  external_subscription_id: string;
  provider: "stripe" | "microsoft";
  plan: "free" | "pro" | "team" | "enterprise";
  status: "trialing" | "active" | "past_due" | "canceled" | "incomplete";
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
  incrementUsage: async (accountId: string, tokens: number) => {
    const now = new Date();
    const yyyymm = parseInt(
      `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}`,
    );

    // Upsert usage record
    // Note: Supabase/PostgREST doesn't have a clean atomic increment without a function or raw SQL usually.
    // But we can try an upsert with on_conflict if we had a unique constraint (we do).
    // However, incrementing requires reading first or using a stored procedure.
    // For MVP Deno, let's read-then-update (optimistic locking not strictly needed for MVP but good practice).

    const { data: existing } = await supabase
      .from("usage_monthly")
      .select("*")
      .eq("account_id", accountId)
      .eq("yyyymm", yyyymm)
      .single();

    let requestsCount = 1;
    let tokensUsed = tokens;

    if (existing) {
      requestsCount = existing.requests_count + 1;
      tokensUsed = existing.tokens_used + tokens;
      await supabase
        .from("usage_monthly")
        .update({
          requests_count: requestsCount,
          tokens_used: tokensUsed,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("usage_monthly").insert({
        account_id: accountId,
        yyyymm,
        requests_count: requestsCount,
        tokens_used: tokensUsed,
      });
    }

    // RFC 014 §8: "consumo de cota Free" — só contagens, sem texto do documento.
    track(
      "usage_incremented",
      { yyyymm, requests_count: requestsCount, tokens_used: tokensUsed },
      accountId,
    );
  },
};
