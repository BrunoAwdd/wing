const YEAR = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <div className="footer-brand">Robbie</div>
          <p className="footer-desc">Seu assistente de documentos no Word.</p>
        </div>
        <div className="footer-col">
          <h4>Produto</h4>
          <ul>
            <li>
              <a href="#recursos">Recursos</a>
            </li>
            <li>
              <a href="#como-funciona">Como funciona</a>
            </li>
            <li>
              <a href="#precos">Preços</a>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Empresa</h4>
          <ul>
            <li>
              <a href="#faq">Perguntas frequentes</a>
            </li>
            <li>
              <a href="/contato?assunto=comercial">Contato</a>
            </li>
            <li>
              <a href="/contato">Suporte</a>
            </li>
          </ul>
        </div>
        <div className="footer-col">
          <h4>Legal</h4>
          <ul>
            <li>
              <a href="/privacidade">Privacidade</a>
            </li>
            <li>
              <a href="/termos">Termos de Uso</a>
            </li>
          </ul>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© {YEAR} Robbie. Todos os direitos reservados.</span>
        <span>Português (Brasil)</span>
      </div>
    </footer>
  );
}
