import { Children, cloneElement, isValidElement, ReactElement, ReactNode } from "react";

interface LegalPageProps {
  title: string;
  updatedAt: string;
  children: ReactNode;
}

export function LegalPage({ title, updatedAt, children }: LegalPageProps) {
  const sections: Array<{ id: string; label: string }> = [];
  const content = Children.toArray(children).map((child) => {
    if (!isValidElement(child) || child.type !== "h2") return child;

    const heading = child as ReactElement<{ children?: ReactNode; id?: string }>;
    const label = typeof heading.props.children === "string"
      ? heading.props.children
      : "Seção";
    const id = heading.props.id ?? `secao-${sections.length + 1}`;
    sections.push({ id, label });
    return cloneElement(heading, { id });
  });

  return (
    <>
      <header className="legal-header">
        <a className="nav-logo" href="/">Robbie</a>
        <a className="btn btn-secondary" href="/">Voltar ao site</a>
      </header>
      <main className="legal-page">
        <header className="legal-title">
          <p className="eyebrow">Documentos legais</p>
          <h1>{title}</h1>
          <p className="legal-updated">Última atualização: {updatedAt}</p>
        </header>

        <div className="legal-layout">
          <aside className="legal-index" aria-label={`Navegação de ${title}`}>
            <span>Nesta página</span>
            <nav>
              {sections.map((section) => (
                <a key={section.id} href={`#${section.id}`}>{section.label}</a>
              ))}
            </nav>
            <a className="legal-help" href="/contato?assunto=privacidade">
              Dúvidas sobre este documento
            </a>
          </aside>

          <div>
            <div className="legal-notice">
              <strong>Documento em preparação</strong>
              <span>A identificação e os canais oficiais da empresa serão preenchidos antes da publicação.</span>
            </div>
            <article className="legal-content">{content}</article>
          </div>
        </div>
      </main>
    </>
  );
}
