import { createCheckoutSession, type PayablePlan } from "../api";
import type { StoredSession } from "./session";

// Redireciona pra URL de checkout retornada pelo Stripe. Não usa
// navegação client-side (é uma saída real do site pro domínio do Stripe).
export async function startCheckout(
  plan: PayablePlan,
  session: StoredSession,
): Promise<void> {
  const url = await createCheckoutSession(plan, session.token);
  window.location.href = url;
}
