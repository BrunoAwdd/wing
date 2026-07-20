import { useEffect, useState } from "react";
import { getBillingStatus } from "../api";
import { getSession } from "../lib/session";

type ConfirmationState = "checking" | "confirmed" | "pending";

export function CheckoutSuccess() {
  const [state, setState] = useState<ConfirmationState>("checking");
  const [plan, setPlan] = useState<"Basic" | "Pro" | null>(null);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setState("pending");
      return;
    }

    let canceled = false;
    const confirmSubscription = async () => {
      for (let attempt = 0; attempt < 12 && !canceled; attempt += 1) {
        try {
          const billing = await getBillingStatus(session.token);
          if (billing.plan === "basic" || billing.plan === "pro") {
            setPlan(billing.plan === "basic" ? "Basic" : "Pro");
            setState("confirmed");
            return;
          }
        } catch {
          // O webhook ou a sessão podem levar alguns segundos para ficar disponíveis.
        }
        await new Promise((resolve) => setTimeout(resolve, 1_500));
      }
      if (!canceled) setState("pending");
    };

    void confirmSubscription();
    return () => {
      canceled = true;
    };
  }, []);

  return (
    <main className="page">
      <section className="signup-card" role="status">
        {state === "checking" && (
          <>
            <h2>Confirmando sua assinatura</h2>
            <p>Estamos aguardando a confirmação segura do pagamento.</p>
          </>
        )}
        {state === "confirmed" && (
          <>
            <h2>Plano {plan} ativado</h2>
            <p>
              Sua assinatura foi confirmada. O próximo passo é instalar o
              suplemento no Word para começar a usar.
            </p>
            <a className="btn btn-primary" href="/instalar">
              Instalar o suplemento agora
            </a>
          </>
        )}
        {state === "pending" && (
          <>
            <h2>Pagamento em processamento</h2>
            <p>
              Ainda não recebemos a confirmação final. Você pode voltar em
              alguns instantes; nenhuma nova cobrança será iniciada.
            </p>
          </>
        )}
        <a className="btn btn-primary" href="/">
          Voltar ao início
        </a>
      </section>
    </main>
  );
}
