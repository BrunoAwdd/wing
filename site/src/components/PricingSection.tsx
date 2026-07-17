import { useState } from "react";
import { CheckIcon } from "./icons";
import { SignupApiError, type PayablePlan } from "../api";
import { getSession } from "../lib/session";
import { startCheckout } from "../lib/checkout";
import { SignupModal } from "./SignupModal";

export function PricingSection() {
  const [loadingPlan, setLoadingPlan] = useState<PayablePlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalPlan, setModalPlan] = useState<PayablePlan | null>(null);

  const handleSubscribe = async (plan: PayablePlan) => {
    setError(null);
    const session = getSession();

    if (!session) {
      setModalPlan(plan);
      return;
    }

    setLoadingPlan(plan);
    try {
      await startCheckout(plan, session);
    } catch (err) {
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
              <strong>R$ 24,90</strong>
              <span>/mês</span>
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
              <strong>R$ 49,90</strong>
              <span>/mês</span>
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
        <SignupModal plan={modalPlan} onClose={() => setModalPlan(null)} />
      )}
    </section>
  );
}
