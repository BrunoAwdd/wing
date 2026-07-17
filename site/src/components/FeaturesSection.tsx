import { EditIcon, TranslateIcon, SummarizeIcon, ChatIcon, DocumentIcon, CompareIcon } from "./icons";

const FEATURES = [
  {
    icon: EditIcon,
    title: "Revisar",
    description: "Corrija gramática, clareza e consistência sem sair do documento.",
  },
  {
    icon: DocumentIcon,
    title: "Reescrever",
    description: "Reformule trechos mantendo o sentido original, no tom que você escolher.",
  },
  {
    icon: TranslateIcon,
    title: "Traduzir",
    description: "Traduza parágrafos ou o documento inteiro preservando a formatação.",
  },
  {
    icon: SummarizeIcon,
    title: "Resumir",
    description: "Gere um resumo objetivo de documentos longos em segundos.",
  },
  {
    icon: ChatIcon,
    title: "Conversar",
    description: "Faça perguntas sobre o conteúdo do documento e receba respostas com contexto.",
  },
  {
    icon: CompareIcon,
    title: "Comparar",
    description: "Veja a versão sugerida lado a lado com o texto original antes de aceitar.",
  },
];

export function FeaturesSection() {
  return (
    <section className="section" id="recursos">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Recursos</span>
          <h2 className="section-title">Tudo que você precisa para trabalhar em um documento</h2>
          <p className="section-subtitle">
            Ações que resolvem o dia a dia de quem revisa e produz documentos.
          </p>
        </div>
        <div className="cards-grid">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div className="card" key={title}>
              <div className="card-icon">
                <Icon size={20} />
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
