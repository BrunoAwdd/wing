import { createCheckoutSession, type PayablePlan } from "../api";
import type { StoredSession } from "./session";

const PENDING_PLAN_KEY = "wing_pending_checkout_plan";

// Guarda a intenção de assinatura de quem clica em "Assinar Basic/Pro"
// antes de ter sessão — o mesmo fluxo de Magic Link serve pra cadastro e
// login (getOrCreateAccountByEmail no backend), então após o código
// verificado o SignupFlow consome isso e segue direto pro checkout, em
// vez de mostrar a tela de sucesso genérica.
export function setPendingCheckoutPlan(plan: PayablePlan): void {
  sessionStorage.setItem(PENDING_PLAN_KEY, plan);
}

export function takePendingCheckoutPlan(): PayablePlan | null {
  const value = sessionStorage.getItem(PENDING_PLAN_KEY);
  sessionStorage.removeItem(PENDING_PLAN_KEY);
  return value === "basic" || value === "pro" ? value : null;
}

// Redireciona pra URL de checkout retornada pelo Stripe. Não usa
// navegação client-side (é uma saída real do site pro domínio do Stripe).
export async function startCheckout(
  plan: PayablePlan,
  session: StoredSession,
): Promise<void> {
  const url = await createCheckoutSession(plan, session.token);
  window.location.href = url;
}
