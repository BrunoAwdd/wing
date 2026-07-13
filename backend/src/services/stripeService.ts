import { Stripe } from "../deps.ts";

const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "";
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || "";
const pricePro = Deno.env.get("STRIPE_PRICE_PRO") || "";
const successUrl = Deno.env.get("STRIPE_SUCCESS_URL") || "";
const cancelUrl = Deno.env.get("STRIPE_CANCEL_URL") || "";
const portalReturnUrl = Deno.env.get("STRIPE_PORTAL_RETURN_URL") || "";

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
    if (!stripeSecretKey) throw new StripeConfigError("STRIPE_SECRET_KEY não configurado.");
    stripeClient = new Stripe(stripeSecretKey, { apiVersion: "2025-02-24.acacia" });
  }
  return stripeClient;
};

export const stripeService = {
  createCheckoutSession: async ({
    accountId,
    email,
    customerId,
  }: {
    accountId: string;
    email: string;
    customerId?: string;
  }): Promise<string> => {
    if (!pricePro) throw new StripeConfigError("STRIPE_PRICE_PRO não configurado.");

    const session = await getStripeClient().checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: pricePro, quantity: 1 }],
      metadata: { account_id: accountId },
      subscription_data: { metadata: { account_id: accountId } },
      success_url: successUrl,
      cancel_url: cancelUrl,
      ...(customerId ? { customer: customerId } : { customer_email: email }),
    });

    if (!session.url) throw new StripeConfigError("Stripe não retornou uma URL de checkout.");
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
      return getStripeClient().webhooks.constructEvent(rawBody, signatureHeader, webhookSecret);
    } catch {
      throw new StripeSignatureError();
    }
  },

};

export type StripeSubscription = Stripe.Subscription;
export type StripeEvent = Stripe.Event;
