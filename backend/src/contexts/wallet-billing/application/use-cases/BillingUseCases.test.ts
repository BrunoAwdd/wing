import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { BillingUseCases } from "./BillingUseCases.ts";
import { SubscriptionRepository, Subscription } from "../ports/out/SubscriptionRepository.ts";
import { WebhookIdempotencyStore } from "../ports/out/WebhookIdempotencyStore.ts";
import { PaymentProvider } from "../ports/out/PaymentProvider.ts";

const fakeSubscriptionRepository = (
  subscription: Pick<Subscription, "plan" | "status" | "current_period_end"> | null,
): SubscriptionRepository => ({
  upsert: async () => {},
  getActiveByAccountId: async () => null,
  findByAccountId: async () => subscription,
});

const fakeIdempotencyStore = (recorded = new Set<string>()): WebhookIdempotencyStore => ({
  recordIfNew: async (event) => {
    if (recorded.has(event.id)) return false;
    recorded.add(event.id);
    return true;
  },
  remove: async (eventId) => {
    recorded.delete(eventId);
  },
});

const fakePaymentProvider = (): PaymentProvider => ({
  createCustomer: async (email) => `cus_${email}`,
});

const noopTelemetry = { track: () => {} };

Deno.test("BillingUseCases.getEntitlement: sem assinatura cai pro plano free", async () => {
  const useCases = new BillingUseCases(
    fakeIdempotencyStore(),
    fakeSubscriptionRepository(null),
    noopTelemetry,
    fakePaymentProvider(),
  );
  assertEquals(await useCases.getEntitlement("acc-1"), { plan: "free", status: "inactive" });
});

Deno.test("BillingUseCases.getEntitlement: status pago com período expirado cai pro plano free", async () => {
  const useCases = new BillingUseCases(
    fakeIdempotencyStore(),
    fakeSubscriptionRepository({
      plan: "pro",
      status: "active",
      current_period_end: new Date(Date.now() - 1_000).toISOString(),
    }),
    noopTelemetry,
    fakePaymentProvider(),
  );
  const entitlement = await useCases.getEntitlement("acc-1");
  assertEquals(entitlement.plan, "free");
});

Deno.test("BillingUseCases.getEntitlement: status pago e período corrente mantém o plano pago", async () => {
  const useCases = new BillingUseCases(
    fakeIdempotencyStore(),
    fakeSubscriptionRepository({
      plan: "pro",
      status: "trialing",
      current_period_end: new Date(Date.now() + 60_000).toISOString(),
    }),
    noopTelemetry,
    fakePaymentProvider(),
  );
  const entitlement = await useCases.getEntitlement("acc-1");
  assertEquals(entitlement, { plan: "pro", status: "trialing" });
});

Deno.test("BillingUseCases.recordWebhookEventIfNew/removeWebhookEvent: delega ao idempotencyStore sem acesso privado", async () => {
  const store = fakeIdempotencyStore();
  const useCases = new BillingUseCases(store, fakeSubscriptionRepository(null), noopTelemetry, fakePaymentProvider());

  const first = await useCases.recordWebhookEventIfNew({ id: "evt-1", type: "x", payload: {} });
  const second = await useCases.recordWebhookEventIfNew({ id: "evt-1", type: "x", payload: {} });
  assertEquals(first, true);
  assertEquals(second, false);

  await useCases.removeWebhookEvent("evt-1");
  const third = await useCases.recordWebhookEventIfNew({ id: "evt-1", type: "x", payload: {} });
  assertEquals(third, true);
});

Deno.test("BillingUseCases.createCustomer: delega ao PaymentProvider injetado (troca de vendor não exige mudar a aplicação)", async () => {
  const useCases = new BillingUseCases(
    fakeIdempotencyStore(),
    fakeSubscriptionRepository(null),
    noopTelemetry,
    fakePaymentProvider(),
  );
  assertEquals(await useCases.createCustomer("a@b.com"), "cus_a@b.com");
});

Deno.test("BillingUseCases.syncSubscriptionFromStripe: grava o plano recebido (basic ou pro), sem assumir um default", async () => {
  const upserted: Partial<Subscription>[] = [];
  const repository: SubscriptionRepository = {
    upsert: async (subscription) => {
      upserted.push(subscription);
    },
    getActiveByAccountId: async () => null,
    findByAccountId: async () => null,
  };
  const useCases = new BillingUseCases(
    fakeIdempotencyStore(),
    repository,
    noopTelemetry,
    fakePaymentProvider(),
  );

  await useCases.syncSubscriptionFromStripe("sub_1", "acc-1", "active", 1_800_000_000, "basic");

  assertEquals(upserted.length, 1);
  assertEquals(upserted[0].plan, "basic");
  assertEquals(upserted[0].account_id, "acc-1");
  assertEquals(upserted[0].external_subscription_id, "sub_1");
});
