import { ShieldIcon } from "./icons";

const ITEMS = [
  {
    title: "Autenticação por e-mail",
    description: "Acesso por código de verificação enviado ao seu e-mail, sem senha para gerenciar.",
  },
  {
    title: "Sessão com expiração",
    description: "As sessões do Robbie expiram automaticamente e podem ser encerradas a qualquer momento.",
  },
  {
    title: "Você decide o que aceitar",
    description: "Nenhuma sugestão altera o documento sem uma ação explícita sua.",
  },
  {
    title: "Uso dentro do Word",
    description: "O conteúdo do documento é processado para responder à sua ação, sem sair do fluxo do editor.",
  },
];

export function SecuritySection() {
  return (
    <section className="section section--alt" id="seguranca">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Controle e segurança</span>
          <h2 className="section-title">Pensado para documentos que importam</h2>
        </div>
        <div className="cards-grid">
          {ITEMS.map((item) => (
            <div className="security-item" key={item.title}>
              <ShieldIcon />
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
