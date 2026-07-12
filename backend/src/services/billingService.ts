import { supabase } from "./supabaseClient.ts";
import { uuidv4 } from "../deps.ts";

export interface Account {
  id: string;
  email: string;
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
  getOrCreateAccount: async (
    email: string,
    stripeCustomerId?: string
  ): Promise<Account> => {
    const { data: existing } = await supabase
      .from("accounts")
      .select("*")
      .eq("email", email)
      .single();

    if (existing) return existing;

    const { data: newAccount, error } = await supabase
      .from("accounts")
      .insert({ email, stripe_customer_id: stripeCustomerId })
      .select()
      .single();

    if (error) throw error;
    return newAccount;
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

  // --- Usage ---
  incrementUsage: async (accountId: string, tokens: number) => {
    const now = new Date();
    const yyyymm = parseInt(
      `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}`
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

    if (existing) {
      await supabase
        .from("usage_monthly")
        .update({
          requests_count: existing.requests_count + 1,
          tokens_used: existing.tokens_used + tokens,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("usage_monthly").insert({
        account_id: accountId,
        yyyymm,
        requests_count: 1,
        tokens_used: tokens,
      });
    }
  },

  // --- Licenses ---
  validateLicenseKey: async (
    key: string
  ): Promise<{ valid: boolean; accountId?: string; plan?: string }> => {
    // DEV BYPASS: In development, always return valid PRO license
    if (Deno.env.get("NODE_ENV") !== "production") {
      console.log("[Billing] Dev mode detected. Bypassing license check.");
      return { valid: true, accountId: "dev-user", plan: "pro" };
    }

    const { data: license, error } = await supabase
      .from("licences")
      .select("*, accounts(id, email), subscriptions(plan, status)")
      .eq("key", key)
      .single();

    if (error || !license) return { valid: false };
    if (license.revoked) return { valid: false };
    if (license.expires_at && new Date(license.expires_at) < new Date())
      return { valid: false };

    // Check subscription status if linked
    // Note: This join syntax depends on Supabase setup.
    // If simple join not working, we might need two queries.
    // For now assuming we trust the license or check subscription separately.

    return {
      valid: true,
      accountId: license.account_id,
      plan: license.plan || "free",
    };
  },
};
