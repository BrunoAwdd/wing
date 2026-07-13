import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application, Router } from "../deps.ts";
import { createBillingRouter, type BillingRouteDependencies } from "./billing.routes.ts";
import { StripeSignatureError } from "../services/stripeService.ts";
import { wingSessionService } from "../services/wingSessionService.ts";

const ACCOUNT_ID = "0f2bbf0f-15af-43e7-83f2-c1ee467f09a1";

const createTestApp = (overrides: Partial<BillingRouteDependencies> = {}) => {
  const dependencies: BillingRouteDependencies = {
    getAccount: async (accountId) => ({
      id: accountId,
      email: "user@example.com",
      created_at: "2026-07-12T12:00:00.000Z",
    }),
    getEntitlement: async () => ({ plan: "free", status: "inactive" }),
    getUsage: async () => 0,
    getOrCreateStripeCustomer: async () => "cus_123",
    createCheckoutSession: async () => "https://checkout.stripe.com/session/xyz",
    createPortalSession: async () => "https://billing.stripe.com/portal/xyz",
    constructWebhookEvent: () => {
      throw new StripeSignatureError();
    },
    recordWebhookEventIfNew: async () => true,
    removeWebhookEvent: async () => undefined,
    syncSubscriptionFromStripe: async () => undefined,
    trackEvent: () => undefined,
    ...overrides,
  };
  const app = new Application();
  const root = new Router();
  const billing = createBillingRouter(dependencies);
  root.use("/api/v1/billing", billing.routes(), billing.allowedMethods());
  app.use(root.routes());
  app.use(root.allowedMethods());
  return app;
};

const withSession = async (): Promise<string> => {
  const { token } = await wingSessionService.issue({ accountId: ACCOUNT_ID });
  return token;
};

Deno.test("Billing /status: exige sessão Wing", async () => {
  const response = await createTestApp().handle(
    new Request("http://localhost/api/v1/billing/status"),
  );
  assertEquals(response?.status, 401);
});

Deno.test("Billing /status: retorna plano, status e uso", async () => {
  const token = await withSession();
  const app = createTestApp({
    getEntitlement: async () => ({ plan: "pro", status: "active" }),
    getUsage: async () => 7,
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/billing/status", {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );

  assertEquals(response?.status, 200);
  const body = await response!.json();
  assertEquals(body, {
    plan: "pro",
    status: "active",
    usage: { requestsCount: 7, limit: 20 },
  });
});

Deno.test("Billing /checkout: exige sessão Wing (401 sem token)", async () => {
  const response = await createTestApp().handle(
    new Request("http://localhost/api/v1/billing/checkout", { method: "POST" }),
  );
  assertEquals(response?.status, 401);
});

Deno.test("Billing /checkout: retorna URL de checkout com sessão válida", async () => {
  const token = await withSession();
  const response = await createTestApp().handle(
    new Request("http://localhost/api/v1/billing/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );

  assertEquals(response?.status, 200);
  const body = await response!.json();
  assertEquals(body.url, "https://checkout.stripe.com/session/xyz");
});

Deno.test("Billing /checkout: falha da Stripe retorna 500 controlado", async () => {
  const token = await withSession();
  const app = createTestApp({
    createCheckoutSession: async () => {
      throw new Error("stripe down");
    },
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/billing/checkout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );

  assertEquals(response?.status, 500);
});

Deno.test("Billing /portal: conta sem stripe_customer_id retorna 400 controlado", async () => {
  const token = await withSession();
  const app = createTestApp({
    getAccount: async (accountId) => ({
      id: accountId,
      email: "user@example.com",
      stripe_customer_id: null,
      created_at: "2026-07-12T12:00:00.000Z",
    }),
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/billing/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );

  assertEquals(response?.status, 400);
});

Deno.test("Billing /portal: retorna URL do portal quando a conta já tem customer Stripe", async () => {
  const token = await withSession();
  const app = createTestApp({
    getAccount: async (accountId) => ({
      id: accountId,
      email: "user@example.com",
      stripe_customer_id: "cus_123",
      created_at: "2026-07-12T12:00:00.000Z",
    }),
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/billing/portal", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );

  assertEquals(response?.status, 200);
  const body = await response!.json();
  assertEquals(body.url, "https://billing.stripe.com/portal/xyz");
});

Deno.test("Billing /webhook: assinatura inválida retorna 400", async () => {
  const response = await createTestApp().handle(
    new Request("http://localhost/api/v1/billing/webhook", {
      method: "POST",
      headers: { "Stripe-Signature": "bad" },
      body: "{}",
    }),
  );

  assertEquals(response?.status, 400);
});

Deno.test("Billing /webhook: evento de assinatura válido sincroniza e retorna 200", async () => {
  let syncedAccountId: string | undefined;
  const app = createTestApp({
    constructWebhookEvent: () => ({
      id: "evt_1",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_1",
          status: "active",
          metadata: { account_id: ACCOUNT_ID },
        },
      },
      // deno-lint-ignore no-explicit-any
    } as any),
    syncSubscriptionFromStripe: async (_subscription, accountId) => {
      syncedAccountId = accountId;
    },
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/billing/webhook", {
      method: "POST",
      headers: { "Stripe-Signature": "valid" },
      body: "{}",
    }),
  );

  assertEquals(response?.status, 200);
  assertEquals(syncedAccountId, ACCOUNT_ID);
});

Deno.test("Billing /webhook: 'created' rastreia conversão distinta de 'updated' (funil não pode misturar os dois)", async () => {
  const trackedEvents: string[] = [];

  const fireEvent = async (id: string, type: string) => {
    const eventApp = createTestApp({
      constructWebhookEvent: () => ({
        id,
        type,
        data: {
          object: { id: "sub_1", status: "active", metadata: { account_id: ACCOUNT_ID } },
        },
        // deno-lint-ignore no-explicit-any
      } as any),
      trackEvent: (eventName) => {
        trackedEvents.push(eventName);
      },
    });
    await eventApp.handle(
      new Request("http://localhost/api/v1/billing/webhook", {
        method: "POST",
        headers: { "Stripe-Signature": "valid" },
        body: "{}",
      }),
    );
  };
  await fireEvent("evt_created", "customer.subscription.created");
  await fireEvent("evt_updated", "customer.subscription.updated");

  assertEquals(trackedEvents, ["subscription_started", "subscription_updated"]);
});

Deno.test("Billing /webhook: evento duplicado (mesmo id) não é reprocessado", async () => {
  let syncCallCount = 0;
  const app = createTestApp({
    constructWebhookEvent: () => ({
      id: "evt_dup",
      type: "customer.subscription.updated",
      data: {
        object: { id: "sub_1", status: "active", metadata: { account_id: ACCOUNT_ID } },
      },
      // deno-lint-ignore no-explicit-any
    } as any),
    recordWebhookEventIfNew: async () => false,
    syncSubscriptionFromStripe: async () => {
      syncCallCount += 1;
    },
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/billing/webhook", {
      method: "POST",
      headers: { "Stripe-Signature": "valid" },
      body: "{}",
    }),
  );

  assertExists(response);
  assertEquals(response!.status, 200);
  const body = await response!.json();
  assertEquals(body.duplicate, true);
  assertEquals(syncCallCount, 0);
});

Deno.test("Billing /webhook: evento não relacionado a assinatura só confirma recebimento", async () => {
  const app = createTestApp({
    constructWebhookEvent: () => ({
      id: "evt_other",
      type: "invoice.paid",
      data: { object: {} },
      // deno-lint-ignore no-explicit-any
    } as any),
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/billing/webhook", {
      method: "POST",
      headers: { "Stripe-Signature": "valid" },
      body: "{}",
    }),
  );

  assertEquals(response?.status, 200);
});

Deno.test("Billing /webhook: falha no processamento desfaz o registro de idempotência (retry reprocessa)", async () => {
  let removedEventId: string | undefined;
  const app = createTestApp({
    constructWebhookEvent: () => ({
      id: "evt_fail",
      type: "customer.subscription.updated",
      data: {
        object: { id: "sub_1", status: "active", metadata: { account_id: ACCOUNT_ID } },
      },
      // deno-lint-ignore no-explicit-any
    } as any),
    syncSubscriptionFromStripe: async () => {
      throw new Error("Supabase indisponível");
    },
    removeWebhookEvent: async (eventId) => {
      removedEventId = eventId;
    },
  });
  const response = await app.handle(
    new Request("http://localhost/api/v1/billing/webhook", {
      method: "POST",
      headers: { "Stripe-Signature": "valid" },
      body: "{}",
    }),
  );

  assertEquals(response?.status, 500);
  assertEquals(removedEventId, "evt_fail");
});
