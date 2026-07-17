export type Plan = "free" | "basic" | "pro" | "team" | "enterprise";

export interface Subscription {
  id: string;
  account_id: string;
  external_subscription_id: string;
  provider: "stripe" | "microsoft";
  plan: Plan;
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

export interface Entitlement {
  plan: Plan;
  status: string;
}

export interface SubscriptionRepository {
  upsert(subscription: Partial<Subscription>): Promise<void>;
  getActiveByAccountId(accountId: string): Promise<Subscription | null>;
  // Retorna a assinatura crua da conta, sem aplicar nenhuma regra de
  // negócio — a decisão "active/trialing + período corrente = plano pago"
  // é responsabilidade da aplicação (BillingUseCases.getEntitlement), não
  // do adaptador de infraestrutura.
  findByAccountId(
    accountId: string,
  ): Promise<Pick<Subscription, "plan" | "status" | "current_period_end"> | null>;
}
