import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  constructStripeWebhookEvent,
  resolveSubscriptionCurrentPeriodEnd,
  type StripeEvent,
  type StripeSubscription,
} from "./stripeService.ts";

Deno.test("constructStripeWebhookEvent: usa a validação assíncrona exigida pelo WebCrypto do Deno", async () => {
  const expected = { id: "evt_test", type: "invoice.paid" } as StripeEvent;
  let received: string[] | undefined;

  const actual = await constructStripeWebhookEvent(
    {
      constructEventAsync: async (body, signature, secret) => {
        received = [body, signature, secret];
        return expected;
      },
    },
    '{"id":"evt_test"}',
    "t=1,v1=signature",
    "whsec_test",
  );

  assertEquals(received, [
    '{"id":"evt_test"}',
    "t=1,v1=signature",
    "whsec_test",
  ]);
  assertEquals(actual, expected);
});

const subscription = (
  currentPeriodEnd?: number,
  itemCurrentPeriodEnd?: number,
): StripeSubscription =>
  ({
    id: "sub_test",
    current_period_end: currentPeriodEnd,
    items: {
      data: [{ current_period_end: itemCurrentPeriodEnd }],
    },
  }) as unknown as StripeSubscription;

Deno.test("resolveSubscriptionCurrentPeriodEnd: aceita payload legado", () => {
  assertEquals(
    resolveSubscriptionCurrentPeriodEnd(subscription(1_800_000_000)),
    1_800_000_000,
  );
});

Deno.test("resolveSubscriptionCurrentPeriodEnd: aceita período no item da Stripe API 2026", () => {
  assertEquals(
    resolveSubscriptionCurrentPeriodEnd(subscription(undefined, 1_900_000_000)),
    1_900_000_000,
  );
});

Deno.test("resolveSubscriptionCurrentPeriodEnd: rejeita payload sem período", () => {
  assertThrows(
    () => resolveSubscriptionCurrentPeriodEnd(subscription()),
    Error,
    "não informou current_period_end",
  );
});
