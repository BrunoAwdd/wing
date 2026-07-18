import { Stripe } from "../deps.ts";
import type { Plan } from "../contexts/wallet-billing/application/ports/out/SubscriptionRepository.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const priceBasicMonthly = Deno.env.get("STRIPE_PRICE_BASIC_MONTHLY") || "";
const priceBasicYearly = Deno.env.get("STRIPE_PRICE_BASIC_YEARLY") || "";
const priceProMonthly = Deno.env.get("STRIPE_PRICE_PRO_MONTHLY") || "";
const priceProYearly = Deno.env.get("STRIPE_PRICE_PRO_YEARLY") || "";
const successUrl = Deno.env.get("STRIPE_SUCCESS_URL") || "";
const cancelUrl = Deno.env.get("STRIPE_CANCEL_URL") || "";
const portalReturnUrl = Deno.env.get("STRIPE_PORTAL_RETURN_URL") || "";

// Único mapeamento preço <-> plano pago vendido hoje (Basic e Pro — ver
// PricingSection no site). Assinaturas Stripe fora desse mapa (ex.: preço
// legado, teste manual no dashboard) não viram plano pago automaticamente;
// syncSubscriptionFromStripe rejeita explicitamente em vez de assumir "pro"
// por padrão, que cobraria/liberaria o nível errado silenciosamente.
export type PayablePlan = "basic" | "pro";
export type BillingPeriod = "monthly" | "yearly";

type CheckoutOffer = `${PayablePlan}_${BillingPeriod}`;

const PRICE_TO_PLAN: Record<string, PayablePlan> = {
  ...(priceBasicMonthly ? { [priceBasicMonthly]: "basic" } : {}),
  ...(priceBasicYearly ? { [priceBasicYearly]: "basic" } : {}),
  ...(priceProMonthly ? { [priceProMonthly]: "pro" } : {}),
  ...(priceProYearly ? { [priceProYearly]: "pro" } : {}),
};

const OFFER_TO_PRICE: Record<CheckoutOffer, string> = {
  basic_monthly: priceBasicMonthly,
  basic_yearly: priceBasicYearly,
  pro_monthly: priceProMonthly,
  pro_yearly: priceProYearly,
};

export const resolvePlanFromPriceId = (
  priceId: string | undefined,
): Plan | null => {
  if (!priceId) return null;
  return PRICE_TO_PLAN[priceId] ?? null;
};

export class StripeSignatureError extends Error {
  constructor(message = "Assinatura do webhook Stripe inválida.") {
    super(message);
    this.name = "StripeSignatureError";
  }
}

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StripeConfigError";
  }
}

// Lazy: instanciar o client no import falha se STRIPE_SECRET_KEY estiver
// vazio (o SDK v17 rejeita string vazia), o que quebraria qualquer módulo
// que importe stripeService.ts — inclusive em testes/ambientes sem chave
// Stripe configurada ainda. Só é necessário no primeiro uso real.
let stripeClient: Stripe | null = null;
const getStripeClient = (): Stripe => {
  if (!stripeClient) {
    if (!stripeSecretKey) {
      throw new StripeConfigError("STRIPE_SECRET_KEY não configurado.");
    }
    stripeClient = new Stripe(stripeSecretKey, {
      apiVersion: "2025-02-24.acacia",
    });
  }
  return stripeClient;
};

export const stripeService = {
  createCheckoutSession: async ({
    accountId,
    email,
    customerId,
    plan,
    billingPeriod,
  }: {
    accountId: string;
    email: string;
    customerId?: string;
    plan: PayablePlan;
    billingPeriod: BillingPeriod;
  }): Promise<string> => {
    const offer: CheckoutOffer = `${plan}_${billingPeriod}`;
    const priceId = OFFER_TO_PRICE[offer];
    if (!priceId) {
      throw new StripeConfigError(
        `Preço Stripe não configurado para ${plan}/${billingPeriod}.`,
      );
    }

    const session = await getStripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      billing_address_collection: "required",
      custom_fields: [
        {
          key: "billing_name",
          label: {
            type: "custom",
            custom: "Nome completo ou razão social",
          },
          type: "text",
          optional: false,
          text: { minimum_length: 2, maximum_length: 120 },
        },
        {
          key: "cpf_cnpj",
          label: {
            type: "custom",
            custom: "CPF ou CNPJ para nota fiscal",
          },
          type: "text",
          optional: false,
          text: { minimum_length: 11, maximum_length: 18 },
        },
      ],
      metadata: { account_id: accountId, plan, billing_period: billingPeriod },
      subscription_data: {
        metadata: {
          account_id: accountId,
          plan,
          billing_period: billingPeriod,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customerId ? { customer: customerId } : { customer_email: email }),
    });

    if (!session.url) {
      throw new StripeConfigError("Stripe não retornou uma URL de checkout.");
    }
    return session.url;
  },

  createPortalSession: async (customerId: string): Promise<string> => {
    const session = await getStripeClient().billingPortal.sessions.create({
      customer: customerId,
      return_url: portalReturnUrl,
    });
    return session.url;
  },

  createCustomer: async (email: string): Promise<string> => {
    const customer = await getStripeClient().customers.create({ email });
    return customer.id;
  },

  // Corpo BRUTO (bytes/string), nunca JSON já parseado — a assinatura é
  // calculada sobre os bytes exatos que a Stripe enviou.
  constructWebhookEvent: (rawBody: string, signatureHeader: string) => {
    try {
      return getStripeClient().webhooks.constructEvent(
        rawBody,
        signatureHeader,
        webhookSecret,
      );
    } catch {
      throw new StripeSignatureError();
    }
  },
};

export type StripeSubscription = Stripe.Subscription;
export type StripeEvent = Stripe.Event;
