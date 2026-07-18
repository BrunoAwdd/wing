import { useState } from "react";
import { CheckIcon } from "./icons";
import { type BillingPeriod, SignupApiError, type PayablePlan } from "../api";
import { clearSession, getSession } from "../lib/session";
import { startCheckout } from "../lib/checkout";
import { SignupModal } from "./SignupModal";

export function PricingSection() {
  const [loadingPlan, setLoadingPlan] = useState<PayablePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalPlan, setModalPlan] = useState<PayablePlan | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("yearly");

  const handleSubscribe = async (plan: PayablePlan) => {
    setError(null);
    const session = getSession();

    if (!session) {
      setModalPlan(plan);
      return;
    }

    setLoadingPlan(plan);
    try {
      await startCheckout(plan, billingPeriod, session);
    } catch (err) {
      if (err instanceof SignupApiError && err.code === "session_expired") {
        clearSession();
        setLoadingPlan(null);
        setModalPlan(plan);
        return;
      }
      setError(err instanceof SignupApiError ? err.message : "Erro inesperado.");
      setLoadingPlan(null);
    }
  };

  return (
    <section className="section" id="precos">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Preços</span>
          <h2 className="section-title">Teste grátis, depois escolha seu plano</h2>
          <div className="billing-period-switch" aria-label="Ciclo de cobrança">
            <button
              type="button"
              className={billingPeriod === "monthly" ? "is-active" : ""}
              aria-pressed={billingPeriod === "monthly"}
              onClick={() => setBillingPeriod("monthly")}
            >
              Mensal
            </button>
            <button
              type="button"
              className={billingPeriod === "yearly" ? "is-active" : ""}
              aria-pressed={billingPeriod === "yearly"}
              onClick={() => setBillingPeriod("yearly")}
            >
              Anual <span>2 meses grátis</span>
            </button>
          </div>
          {error && (
            <p className="signup-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <div className="pricing-grid">
          <div className="price-card">
            <span className="price-card-name">Teste grátis</span>
            <p className="price-card-price">
              <strong>R$ 0</strong>
            </p>
            <p className="price-card-credits">500 créditos, únicos</p>
            <p className="price-card-desc">
              Válido por 30 dias ou até acabar os créditos — o que vier primeiro.
              Sem cartão de crédito.
            </p>
            <ul className="price-card-features">
              <li>
                <CheckIcon size={16} />
                Revisão, tradução e resumo
              </li>
              <li>
                <CheckIcon size={16} />
                Conversa com documentos
              </li>
              <li>
                <CheckIcon size={16} />
                Um teste por conta, sem renovação
              </li>
            </ul>
            <a className="btn btn-secondary btn-block" href="#cadastro">
              Começar teste grátis
            </a>
          </div>

          <div className="price-card">
            <span className="price-card-name">Basic</span>
            <p className="price-card-price">
              <strong>{billingPeriod === "yearly" ? "R$ 20,75" : "R$ 24,90"}</strong>
              <span>/mês</span>
            </p>
            <p className="price-card-billing">
              {billingPeriod === "yearly" ? (
                <>R$ 249 cobrados por ano <strong>Economize R$ 49,80</strong></>
              ) : (
                <>Cobrança mensal <strong>Cancele quando quiser</strong></>
              )}
            </p>
            <p className="price-card-credits">3.500 créditos por mês</p>
            <p className="price-card-desc">Para uso recorrente no dia a dia.</p>
            <ul className="price-card-features">
              <li>
                <CheckIcon size={16} />
                Créditos renovados todo mês
              </li>
              <li>
                <CheckIcon size={16} />
                Revisão, tradução, resumo e conversa
              </li>
              <li>
                <CheckIcon size={16} />
                Sem interrupção entre documentos
              </li>
            </ul>
            <button
              type="button"
              className="btn btn-secondary btn-block"
              disabled={loadingPlan !== null}
              onClick={() => handleSubscribe("basic")}
            >
              {loadingPlan === "basic" ? "Redirecionando…" : "Assinar Basic"}
            </button>
          </div>

          <div className="price-card price-card--featured">
            <span className="price-card-name">Pro</span>
            <p className="price-card-price">
              <strong>{billingPeriod === "yearly" ? "R$ 41,58" : "R$ 49,90"}</strong>
              <span>/mês</span>
            </p>
            <p className="price-card-billing">
              {billingPeriod === "yearly" ? (
                <>R$ 499 cobrados por ano <strong>Economize R$ 99,80</strong></>
              ) : (
                <>Cobrança mensal <strong>Cancele quando quiser</strong></>
              )}
            </p>
            <p className="price-card-credits">8.000 créditos por mês</p>
            <p className="price-card-desc">Para uso intenso com qualidade máxima.</p>
            <ul className="price-card-features">
              <li>
                <CheckIcon size={16} />
                Mais que o dobro dos créditos do Basic
              </li>
              <li>
                <CheckIcon size={16} />
                Nível de qualidade Profundo
              </li>
              <li>
                <CheckIcon size={16} />
                Suporte prioritário
              </li>
            </ul>
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={loadingPlan !== null}
              onClick={() => handleSubscribe("pro")}
            >
              {loadingPlan === "pro" ? "Redirecionando…" : "Assinar Pro"}
            </button>
          </div>
        </div>
      </div>
      {modalPlan && (
        <SignupModal
          plan={modalPlan}
          billingPeriod={billingPeriod}
          onClose={() => setModalPlan(null)}
        />
      )}
    </section>
  );
}
