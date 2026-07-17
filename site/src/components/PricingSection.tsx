import { CheckIcon } from "./icons";

export function PricingSection() {
  return (
    <section className="section" id="precos">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Preços</span>
          <h2 className="section-title">Teste grátis, depois escolha seu plano</h2>
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
            <button type="button" className="btn btn-secondary btn-block" aria-disabled="true">
              Assinar Basic (em breve)
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
            <button type="button" className="btn btn-primary btn-block" aria-disabled="true">
              Assinar Pro (em breve)
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
