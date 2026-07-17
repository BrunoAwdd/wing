import { WordMockup } from "./WordMockup";

const STEPS = [
  "Selecione um trecho",
  "Clique em reescrever",
  "Robbie sugere uma versão",
  "Compare antes e depois",
  "Aceite a alteração",
];

export function DemoSection() {
  return (
    <section className="section section--alt" id="demonstracao">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Demonstração</span>
          <h2 className="section-title">Veja o Robbie trabalhando dentro do Word</h2>
          <p className="section-subtitle">
            O painel do Robbie fica ao lado do seu documento. Você seleciona,
            pede a ação e decide o que aceitar.
          </p>
        </div>
        <WordMockup />
        <ol className="demo-steps">
          {STEPS.map((step, index) => (
            <li className="demo-step" key={step}>
              <span className="demo-step-number">{index + 1}</span>
              <p>{step}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
