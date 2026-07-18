function ChevronDownIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronUpIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path d="M2.5 7.5L6 4l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DocIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="3" y="2" width="10" height="12" rx="1" stroke="currentColor" strokeWidth="1.3" />
      <path d="M5.5 6h5M5.5 9h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function SyncIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 8a5 5 0 1 1-1.6-3.67M13 2v2.8h-2.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 5v3l2 1.2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="2.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 2.5v1.4M8 12.1v1.4M13.5 8h-1.4M3.9 8H2.5M11.7 4.3l-1 1M5.3 9.7l-1 1M11.7 11.7l-1-1M5.3 6.3l-1-1"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M2 8l12-5.5L9.5 14l-1.8-4.7L2 8Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

export function WordMockup() {
  return (
    <div className="word-mockup" role="img" aria-label="Janela do Word ao lado do painel do Robbie, com as ações Revisar, Traduzir, Resumir e Fale com o documento">
      <div className="word-mockup-titlebar">
        <span className="word-mockup-dot" />
        <span className="word-mockup-dot" />
        <span className="word-mockup-dot" />
      </div>
      <div className="word-mockup-body">
        <div className="word-mockup-doc">
          <div className="word-mockup-line" />
          <div className="word-mockup-line word-mockup-line--short" />
          <div className="word-mockup-line word-mockup-highlight" />
          <div className="word-mockup-line" />
          <div className="word-mockup-line" />
          <div className="word-mockup-line word-mockup-line--short" />
        </div>

        <div className="taskpane">
          <div className="taskpane-header">Robbie</div>

          <div className="taskpane-selection">
            <DocIcon />
            <span>1 parágrafo selecionado</span>
            <ChevronDownIcon />
          </div>

          <div className="taskpane-action-grid">
            <button type="button" className="taskpane-btn taskpane-btn--primary">
              Revisar <ChevronDownIcon />
            </button>
            <button type="button" className="taskpane-btn taskpane-btn--primary">
              Traduzir <ChevronDownIcon />
            </button>
          </div>
          <button type="button" className="taskpane-btn taskpane-btn--outline">
            Resumir
          </button>

          <div className="taskpane-section">
            <div className="taskpane-section-header">
              <span>Documento</span>
              <ChevronUpIcon />
            </div>
            <div className="taskpane-section-item">
              <DocIcon />
              <span>Selecionar tudo</span>
            </div>
            <div className="taskpane-section-item">
              <SyncIcon />
              <span>Atualizar memória</span>
            </div>
          </div>

          <button type="button" className="taskpane-btn taskpane-btn--primary taskpane-chat-btn">
            Fale com o documento
          </button>

          <div className="taskpane-input-bar">
            <span className="taskpane-input-placeholder">Ou digite um comando...</span>
            <span className="taskpane-input-icons">
              <SyncIcon />
              <HistoryIcon />
              <SettingsIcon />
              <SendIcon />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
