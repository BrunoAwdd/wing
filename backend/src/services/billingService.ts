import { supabase } from "./supabaseClient.ts";
import { track } from "./telemetry.ts";
import type { TelemetryEventName } from "./telemetryCatalog.ts";
import {
  resolvePlanFromPriceId,
  resolveSubscriptionCurrentPeriodEnd,
  type StripeSubscription,
} from "./stripeService.ts";
import type { MicrosoftIdentity } from "./microsoftIdentityService.ts";

import { WalletUseCases } from "../contexts/wallet-billing/application/use-cases/WalletUseCases.ts";
import { BillingUseCases } from "../contexts/wallet-billing/application/use-cases/BillingUseCases.ts";
import { SupabaseWalletRepository } from "../contexts/wallet-billing/infrastructure/adapters/SupabaseWalletRepository.ts";
import { SupabaseSubscriptionRepository } from "../contexts/wallet-billing/infrastructure/adapters/SupabaseSubscriptionRepository.ts";
import { SupabaseWebhookIdempotencyStore } from "../contexts/wallet-billing/infrastructure/adapters/SupabaseWebhookIdempotencyStore.ts";
import { StripePaymentProvider } from "../contexts/wallet-billing/infrastructure/adapters/StripePaymentProvider.ts";

const walletUseCases = new WalletUseCases(new SupabaseWalletRepository());
const freeAccessCap = Number.parseInt(
  Deno.env.get("WING_FREE_ACCESS_CAP") ?? "20",
  10,
);
if (!Number.isInteger(freeAccessCap) || freeAccessCap < 0) {
  throw new Error(
    "WING_FREE_ACCESS_CAP deve ser um inteiro maior ou igual a zero.",
  );
}
const billingUseCases = new BillingUseCases(
  new SupabaseWebhookIdempotencyStore(),
  new SupabaseSubscriptionRepository(),
  {
    track: (eventName, properties, accountId) =>
      track(
        eventName as TelemetryEventName,
        properties as Record<string, unknown> | undefined,
        accountId,
      ),
  },
  new StripePaymentProvider(),
);

export interface Account {
  id: string;
  email: string;
  display_name?: string | null;
  microsoft_tenant_id?: string | null;
  microsoft_object_id?: string | null;
  stripe_customer_id?: string | null;
  revoked_at?: string | null;
  free_access_granted_at?: string | null;
  waitlisted_at?: string | null;
  waitlist_position?: number | null;
  created_at: string;
}

export class AccountNotFoundError extends Error {
  constructor() {
    super("Conta Wing não encontrada para a sessão informada.");
    this.name = "AccountNotFoundError";
  }
}

// União completa dos status que a Stripe pode enviar (RFC 015 §8) — só
// "trialing"/"active" contam como Pro em getEntitlement, o resto é Free.
export interface Subscription {
  id: string;
  account_id: string;
  external_subscription_id: string;
  provider: "stripe" | "microsoft";
  plan: "free" | "basic" | "pro" | "team" | "enterprise";
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

async function ensureFreeAccessStatus(account: Account): Promise<Account> {
  if (account.free_access_granted_at || account.waitlisted_at) return account;

  const { data, error } = await supabase.rpc("claim_free_access", {
    p_account_id: account.id,
    p_limit: freeAccessCap,
  });
  if (error) throw error;

  const row = (Array.isArray(data) ? data[0] : data) as {
    access_status: "free" | "waitlisted";
    waitlist_position: number | null;
  };
  return {
    ...account,
    free_access_granted_at: row.access_status === "free"
      ? new Date().toISOString()
      : null,
    waitlisted_at: row.access_status === "waitlisted"
      ? new Date().toISOString()
      : null,
    waitlist_position: row.waitlist_position === null
      ? null
      : Number(row.waitlist_position),
  };
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

      if (Object.keys(updates).length === 0) {
        return await ensureFreeAccessStatus(existing);
      }

      const { data: updated, error } = await supabase
        .from("accounts")
        .update(updates)
        .eq("id", existing.id)
        .select()
        .single();
      if (error) throw error;
      return await ensureFreeAccessStatus(updated);
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
    return await ensureFreeAccessStatus(newAccount);
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
    if (existing) return await ensureFreeAccessStatus(existing);

    const { data: newAccount, error } = await supabase
      .from("accounts")
      .insert({ email })
      .select()
      .single();

    if (error) throw error;
    return await ensureFreeAccessStatus(newAccount);
  },

  getAccount: async (accountId: string): Promise<Account> => {
    const { data, error } = await supabase
      .from("accounts")
      .select("*")
      .eq("id", accountId)
      .maybeSingle();

    if (error) throw error;
    if (!data) throw new AccountNotFoundError();
    return data;
  },

  isAccountRevoked: async (accountId: string): Promise<boolean> => {
    const { data, error } = await supabase
      .from("accounts")
      .select("revoked_at")
      .eq("id", accountId)
      .single();
    if (error) throw error;
    return typeof data.revoked_at === "string";
  },

  // --- Subscriptions ---
  upsertSubscription: async (subscription: Partial<Subscription>) => {
    await billingUseCases.upsertSubscription(subscription);
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
    return billingUseCases.getEntitlement(accountId);
  },

  // --- Usage ---
  reserveCredits: async (
    accountId: string,
    model: string,
    credits: number,
    limit: number | null,
  ): Promise<
    { reservationId: string; creditsUsed: number; allowed: boolean }
  > => {
    return walletUseCases.reserveCredits(accountId, model, credits, limit);
  },

  settleCredits: async (
    reservationId: string,
    charge: { credits: number; inputTokens: number; outputTokens: number },
  ): Promise<number> => {
    return walletUseCases.settleCredits(
      reservationId,
      charge.credits,
      charge.inputTokens,
      charge.outputTokens,
    );
  },

  reserveTrialCredits: async (
    accountId: string,
    model: string,
    credits: number,
    limit: number,
    trialDurationSeconds: number,
  ): Promise<
    {
      reservationId: string;
      creditsUsed: number;
      allowed: boolean;
      trialExpired: boolean;
      waitlisted?: boolean;
    }
  > => {
    const { data: account, error } = await supabase
      .from("accounts")
      .select("free_access_granted_at")
      .eq("id", accountId)
      .single();
    if (error) throw error;
    if (!account.free_access_granted_at) {
      return {
        reservationId: "",
        creditsUsed: 0,
        allowed: false,
        trialExpired: false,
        waitlisted: true,
      };
    }
    return walletUseCases.reserveTrialCredits(
      accountId,
      model,
      credits,
      limit,
      trialDurationSeconds,
    ).then((result) => ({ ...result, waitlisted: false }));
  },

  settleTrialCredits: async (
    reservationId: string,
    charge: { credits: number; inputTokens: number; outputTokens: number },
  ): Promise<number> => {
    return walletUseCases.settleTrialCredits(
      reservationId,
      charge.credits,
      charge.inputTokens,
      charge.outputTokens,
    );
  },

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
    const result = await walletUseCases.incrementUsage(
      accountId,
      tokens,
      limit,
    );

    if (result.allowed) {
      const now = new Date();
      const yyyymm = parseInt(
        `${now.getFullYear()}${
          (now.getMonth() + 1).toString().padStart(2, "0")
        }`,
      );
      track(
        "usage_incremented",
        { yyyymm, requests_count: result.requestsCount, tokens_used: tokens },
        accountId,
      );
    }

    return result;
  },

  // --- Stripe ---
  getOrCreateStripeCustomer: async (account: Account): Promise<string> => {
    if (account.stripe_customer_id) return account.stripe_customer_id;

    const customerId = await billingUseCases.createCustomer(account.email);
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
  }): Promise<boolean> => {
    return billingUseCases.recordWebhookEventIfNew(event);
  },

  removeWebhookEvent: async (eventId: string): Promise<void> => {
    await billingUseCases.removeWebhookEvent(eventId);
  },

  syncSubscriptionFromStripe: async (
    stripeSubscription: StripeSubscription,
    accountId: string,
  ): Promise<void> => {
    const priceId = stripeSubscription.items.data[0]?.price?.id;
    const plan = resolvePlanFromPriceId(priceId);
    if (!plan) {
      throw new Error(
        `[Billing] Assinatura Stripe ${stripeSubscription.id} usa um preço (${priceId}) que não mapeia pra nenhuma oferta configurada.`,
      );
    }
    await billingUseCases.syncSubscriptionFromStripe(
      stripeSubscription.id,
      accountId,
      stripeSubscription.status as Subscription["status"],
      resolveSubscriptionCurrentPeriodEnd(stripeSubscription),
      plan,
    );
  },
};
