import { Router } from "../deps.ts";
import { supabase } from "../services/supabaseClient.ts";
import { type Account, billingService } from "../services/billingService.ts";
import {
  type StripeEvent,
  stripeService,
  StripeSignatureError,
} from "../services/stripeService.ts";
import { track } from "../services/telemetry.ts";
import type { TelemetryEventName } from "../services/telemetryCatalog.ts";
import {
  getWingAuth,
  requireWingSession,
} from "../middlewares/authMiddleware.ts";

const FREE_MONTHLY_CREDIT_LIMIT = Number(
  Deno.env.get("WING_FREE_MONTHLY_CREDITS") || "1000",
);

export interface BillingRouteDependencies {
  getAccount: (accountId: string) => Promise<Account>;
  getEntitlement: (
    accountId: string,
  ) => ReturnType<typeof billingService.getEntitlement>;
  getUsage: (accountId: string, yyyymm: number) => Promise<{
    requestsCount: number;
    tokensUsed: number;
    creditsUsed: number;
  }>;
  getOrCreateStripeCustomer: (account: Account) => Promise<string>;
  createCheckoutSession: typeof stripeService.createCheckoutSession;
  createPortalSession: typeof stripeService.createPortalSession;
  constructWebhookEvent: typeof stripeService.constructWebhookEvent;
  recordWebhookEventIfNew: typeof billingService.recordWebhookEventIfNew;
  removeWebhookEvent: typeof billingService.removeWebhookEvent;
  syncSubscriptionFromStripe: typeof billingService.syncSubscriptionFromStripe;
  trackEvent: typeof track;
}

const defaultDependencies: BillingRouteDependencies = {
  getAccount: billingService.getAccount,
  getEntitlement: billingService.getEntitlement,
  getUsage: async (accountId, yyyymm) => {
    const { data } = await supabase
      .from("usage_monthly")
      .select("requests_count, tokens_used, credits_used")
      .eq("account_id", accountId)
      .eq("yyyymm", yyyymm)
      .maybeSingle();
    return {
      requestsCount: Number(data?.requests_count || 0),
      tokensUsed: Number(data?.tokens_used || 0),
      creditsUsed: Number(data?.credits_used || 0),
    };
  },
  getOrCreateStripeCustomer: billingService.getOrCreateStripeCustomer,
  createCheckoutSession: stripeService.createCheckoutSession,
  createPortalSession: stripeService.createPortalSession,
  constructWebhookEvent: stripeService.constructWebhookEvent,
  recordWebhookEventIfNew: billingService.recordWebhookEventIfNew,
  removeWebhookEvent: billingService.removeWebhookEvent,
  syncSubscriptionFromStripe: billingService.syncSubscriptionFromStripe,
  trackEvent: track,
};

// Eventos de assinatura tratados (RFC 015 §4). checkout.session.completed só
// garante que o customer ficou vinculado; quem sincroniza plano/status de
// fato são os eventos de subscription — o Checkout já dispara um deles.
const SUBSCRIPTION_EVENTS = new Set([
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "customer.subscription.paused",
  "customer.subscription.resumed",
]);

// Nome de evento de telemetria por tipo de evento Stripe — "created" é a
// única conversão de verdade (Free -> Pro); os demais são mudanças de
// estado de uma assinatura já existente, não devem ser somados ao funil.
const SUBSCRIPTION_EVENT_TRACKING: Record<string, TelemetryEventName> = {
  "customer.subscription.created": "subscription_started",
  "customer.subscription.updated": "subscription_updated",
  "customer.subscription.deleted": "subscription_canceled",
  "customer.subscription.paused": "subscription_paused",
  "customer.subscription.resumed": "subscription_resumed",
};

export const createBillingRouter = (
  dependencies: BillingRouteDependencies = defaultDependencies,
) => {
  const router = new Router();

  router.get("/status", requireWingSession, async (ctx) => {
    const auth = getWingAuth(ctx);
    const entitlement = await dependencies.getEntitlement(auth.accountId);

    const now = new Date();
    const yyyymm = parseInt(
      `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}`,
    );
    // Leitura direta (sem incrementar) — só pra exibir o uso atual.
    const usage = await dependencies.getUsage(auth.accountId, yyyymm);

    ctx.response.status = 200;
    ctx.response.body = {
      plan: entitlement.plan,
      status: entitlement.status,
      usage: {
        ...usage,
        creditLimit: entitlement.plan === "free"
          ? FREE_MONTHLY_CREDIT_LIMIT
          : null,
      },
    };
  });

  router.post("/checkout", requireWingSession, async (ctx) => {
    const auth = getWingAuth(ctx);
    try {
      const account = await dependencies.getAccount(auth.accountId);
      const customerId = await dependencies.getOrCreateStripeCustomer(account);
      const url = await dependencies.createCheckoutSession({
        accountId: auth.accountId,
        email: account.email,
        customerId,
      });
      dependencies.trackEvent("checkout_started", undefined, auth.accountId);
      ctx.response.status = 200;
      ctx.response.body = { url };
    } catch (error) {
      console.error("[Billing] Falha ao criar checkout:", error);
      dependencies.trackEvent("checkout_failed", undefined, auth.accountId);
      ctx.response.status = 500;
      ctx.response.body = { error: "Não foi possível iniciar o checkout." };
    }
  });

  router.post("/portal", requireWingSession, async (ctx) => {
    const auth = getWingAuth(ctx);
    const account = await dependencies.getAccount(auth.accountId);

    if (!account.stripe_customer_id) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Conta ainda não possui assinatura Stripe.",
      };
      return;
    }

    try {
      const url = await dependencies.createPortalSession(
        account.stripe_customer_id,
      );
      ctx.response.status = 200;
      ctx.response.body = { url };
    } catch (error) {
      console.error("[Billing] Falha ao criar sessão do portal:", error);
      ctx.response.status = 500;
      ctx.response.body = {
        error: "Não foi possível abrir o portal de assinatura.",
      };
    }
  });

  // Sem requireWingSession: a Stripe não tem uma sessão Wing, a autenticidade
  // vem inteiramente da assinatura HMAC no header Stripe-Signature.
  router.post("/webhook", async (ctx) => {
    const rawBody = await ctx.request.body.text();
    const signature = ctx.request.headers.get("Stripe-Signature") || "";

    let event: StripeEvent;
    try {
      event = dependencies.constructWebhookEvent(rawBody, signature);
    } catch (error) {
      if (error instanceof StripeSignatureError) {
        ctx.response.status = 400;
        ctx.response.body = { error: "Assinatura inválida." };
        return;
      }
      throw error;
    }

    const isNew = await dependencies.recordWebhookEventIfNew({
      id: event.id,
      type: event.type,
      payload: event,
    });

    if (!isNew) {
      // Retry da Stripe pra um evento já processado — não duplica nada.
      ctx.response.status = 200;
      ctx.response.body = { ok: true, duplicate: true };
      return;
    }

    try {
      if (SUBSCRIPTION_EVENTS.has(event.type)) {
        const subscription = event.data.object as {
          id: string;
          metadata?: { account_id?: string };
        };
        const accountId = subscription.metadata?.account_id;
        if (accountId) {
          // deno-lint-ignore no-explicit-any
          await dependencies.syncSubscriptionFromStripe(
            subscription as any,
            accountId,
          );
          // Sinal de conversão real: só "created" marca uma assinatura NOVA.
          // "updated" dispara em renovação, troca de plano, retry de
          // pagamento etc. — dezenas de vezes ao longo da vida de UMA
          // assinatura. Misturar os dois num único evento torna qualquer
          // funil de conversão incontável (super-conta drasticamente).
          dependencies.trackEvent(
            SUBSCRIPTION_EVENT_TRACKING[event.type],
            undefined,
            accountId,
          );
        }
      }
      // checkout.session.completed: a assinatura já chega via customer.subscription.created
      // logo em seguida — nada adicional a fazer aqui além de já ter registrado o evento.

      ctx.response.status = 200;
      ctx.response.body = { ok: true };
    } catch (error) {
      console.error(
        `[Billing] Falha ao processar webhook ${event.type}:`,
        error,
      );
      // Desfaz o registro de idempotência: sem isso, o próximo retry da
      // Stripe (mesmo event.id) bateria no unique_violation e seria
      // descartado como duplicado sem nunca ser reprocessado.
      await dependencies.removeWebhookEvent(event.id).catch((cleanupError) => {
        console.error(
          `[Billing] Falha ao limpar webhook_events para retry de ${event.id}:`,
          cleanupError,
        );
      });
      ctx.response.status = 500;
      ctx.response.body = { error: "Falha ao processar o evento." };
    }
  });

  return router;
};

export default createBillingRouter();
