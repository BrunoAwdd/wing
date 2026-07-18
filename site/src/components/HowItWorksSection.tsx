const STEPS = [
  {
    title: "Instale o suplemento",
    description: "Adicione o Robbie ao Word em poucos minutos, sem instalação complexa.",
  },
  {
    title: "Selecione o texto",
    description: "Marque o trecho ou trabalhe com o documento inteiro.",
  },
  {
    title: "Escolha a ação",
    description: "Revisar, reescrever, traduzir, resumir ou perguntar sobre o conteúdo.",
  },
  {
    title: "Revise e aceite",
    description: "Compare a sugestão com o original e decida o que entra no documento.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="section section--alt" id="como-funciona">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Como funciona</span>
          <h2 className="section-title">Do documento aberto à sugestão aceita</h2>
        </div>
        <ol className="steps-grid">
          {STEPS.map((step, index) => (
            <li className="step-card" key={step.title}>
              <span className="step-number">{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
