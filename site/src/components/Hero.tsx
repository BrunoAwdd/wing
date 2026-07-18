import { WordMockup } from "./WordMockup";

export function Hero() {
  return (
    <section className="hero">
      <div className="container hero-grid">
        <div className="hero-content">
          <span className="eyebrow">Assistente de documentos no Word</span>
          <h1 className="hero-headline">
            Revise, reescreva e converse com seus documentos sem sair do Word.
          </h1>
          <p className="hero-subheadline">
            O Robbie ajuda você a corrigir, reformular, traduzir, resumir e
            entender documentos diretamente no Microsoft Word.
          </p>
          <div className="hero-ctas">
            <a className="btn btn-primary" href="#cadastro">
              Testar gratuitamente
            </a>
            <a className="btn btn-secondary" href="#demonstracao">
              Assistir demonstração
            </a>
          </div>
          <p className="hero-proof">Sem copiar e colar. Sem sair do documento.</p>
        </div>
        <WordMockup />
      </div>
    </section>
  );
}
