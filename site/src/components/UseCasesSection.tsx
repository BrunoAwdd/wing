const USE_CASES = [
  {
    title: "Escritórios de advocacia",
    problem: "Petições e contratos longos, revisados linha a linha.",
    action: "Revisão e resumo direto no documento, sem copiar trechos sigilosos para fora do Word.",
    result: "Menos tempo em releitura manual antes de protocolar.",
  },
  {
    title: "Times de RH e operações",
    problem: "Relatórios e políticas internas que precisam de tom consistente.",
    action: "Reescrita para padronizar linguagem e corrigir gramática em lote.",
    result: "Documentos revisados sem depender de outra ferramenta.",
  },
  {
    title: "Consultorias e agências",
    problem: "Propostas comerciais recorrentes, adaptadas para cada cliente.",
    action: "Conversa com o documento para localizar e ajustar seções específicas rapidamente.",
    result: "Menos idas e vindas entre rascunho e versão final.",
  },
];

export function UseCasesSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Casos de uso</span>
          <h2 className="section-title">Feito para quem trabalha com documentos todos os dias</h2>
        </div>
        <div className="cards-grid">
          {USE_CASES.map((useCase) => (
            <div className="card usecase-card" key={useCase.title}>
              <h3>{useCase.title}</h3>
              <dl>
                <div className="usecase-row">
                  <dt>Problema</dt>
                  <dd>{useCase.problem}</dd>
                </div>
                <div className="usecase-row">
                  <dt>Ação</dt>
                  <dd>{useCase.action}</dd>
                </div>
                <div className="usecase-row">
                  <dt>Resultado</dt>
                  <dd>{useCase.result}</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
