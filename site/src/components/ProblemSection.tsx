import { DocumentIcon, CompareIcon, ChatIcon } from "./icons";

const PROBLEMS = [
  {
    icon: DocumentIcon,
    title: "Copiar e colar quebra o documento",
    description:
      "Levar um trecho para outra ferramenta e trazer de volta costuma bagunçar formatação, estilos e numeração.",
  },
  {
    icon: CompareIcon,
    title: "Trocar de ferramenta consome tempo",
    description:
      "Alternar entre o Word e um chat separado interrompe o raciocínio e atrasa a revisão do documento.",
  },
  {
    icon: ChatIcon,
    title: "Entender um documento longo é lento",
    description:
      "Contratos, petições e relatórios extensos exigem releitura repetida só para localizar um ponto específico.",
  },
];

export function ProblemSection() {
  return (
    <section className="section">
      <div className="container">
        <div className="section-header">
          <h2 className="section-title">Editar documentos não devia exigir sair deles</h2>
          <p className="section-subtitle">
            O trabalho com documentos importantes ainda depende de idas e
            vindas entre ferramentas diferentes.
          </p>
        </div>
        <div className="problem-grid">
          {PROBLEMS.map(({ icon: Icon, title, description }) => (
            <div className="problem-card" key={title}>
              <div className="problem-card-icon">
                <Icon size={28} />
              </div>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
