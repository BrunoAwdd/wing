import { WebhookIdempotencyStore } from "../ports/out/WebhookIdempotencyStore.ts";
import {
  Entitlement,
  Plan,
  Subscription,
  SubscriptionRepository,
} from "../ports/out/SubscriptionRepository.ts";
import { PaymentProvider } from "../ports/out/PaymentProvider.ts";

export interface TelemetryPort {
  track(eventName: string, properties: unknown, accountId: string): void;
}

export class BillingUseCases {
  constructor(
    private readonly idempotencyStore: WebhookIdempotencyStore,
    private readonly subscriptionRepository: SubscriptionRepository,
    private readonly telemetry: TelemetryPort,
    private readonly paymentProvider: PaymentProvider,
  ) {}

  // Trocar de provedor de pagamento (ex: sair da Stripe) só exige uma nova
  // implementação de PaymentProvider — a aplicação nunca importa o SDK do
  // vendor diretamente.
  async createCustomer(email: string): Promise<string> {
    return this.paymentProvider.createCustomer(email);
  }

  async processWebhookEvent(
    event: { id: string; type: string },
    onNewEvent: () => Promise<void>,
  ) {
    const isNew = await this.idempotencyStore.recordIfNew(event);
    if (!isNew) {
      return { duplicate: true };
    }

    try {
      await onNewEvent();
    } catch (error) {
      await this.idempotencyStore.remove(event.id).catch((cleanupError) => {
        console.error(
          `[Billing] Falha ao limpar webhook_events para retry de ${event.id}:`,
          cleanupError,
        );
      });
      throw error;
    }

    return { duplicate: false };
  }

  async syncSubscriptionFromStripe(
    stripeSubscriptionId: string,
    accountId: string,
    status: Subscription["status"],
    currentPeriodEndSeconds: number,
    plan: Plan,
  ) {
    await this.subscriptionRepository.upsert({
      account_id: accountId,
      external_subscription_id: stripeSubscriptionId,
      provider: "stripe",
      plan,
      status,
      current_period_end: new Date(currentPeriodEndSeconds * 1000)
        .toISOString(),
    });
  }

  // Regra comercial "active/trialing + período corrente = plano pago"
  // pertence à aplicação, não ao adaptador do Supabase — trocar de
  // provedor de assinaturas não deve exigir reimplementar essa decisão.
  async getEntitlement(accountId: string): Promise<Entitlement> {
    const subscription = await this.subscriptionRepository.findByAccountId(
      accountId,
    );
    if (!subscription) return { plan: "free", status: "inactive" };

    const paidStatus = subscription.status === "active" ||
      subscription.status === "trialing";
    const periodIsCurrent =
      typeof subscription.current_period_end === "string" &&
      new Date(subscription.current_period_end).getTime() > Date.now();

    if (!paidStatus || !periodIsCurrent) {
      return { plan: "free", status: subscription.status };
    }

    return { plan: subscription.plan, status: subscription.status };
  }

  async upsertSubscription(subscription: Partial<Subscription>): Promise<void> {
    await this.subscriptionRepository.upsert(subscription);
  }

  async recordWebhookEventIfNew(
    event: { id: string; type: string },
  ): Promise<boolean> {
    return this.idempotencyStore.recordIfNew(event);
  }

  async removeWebhookEvent(eventId: string): Promise<void> {
    await this.idempotencyStore.remove(eventId);
  }
}
