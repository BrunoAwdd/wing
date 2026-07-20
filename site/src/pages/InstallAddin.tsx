const ADDIN_URL = "https://robbie.awdd.com.br";
const MANIFEST_URL = `${ADDIN_URL}/manifest.xml`;

export function InstallAddin() {
  return (
    <main className="page">
      <section className="signup-card" role="status">
        <h2>Instalar o Robbie no Word</h2>
        <p>
          Sua conta já está pronta. Falta só carregar o suplemento no Word —
          leva menos de um minuto.
        </p>

        <ol className="install-steps">
          <li>
            No Word, abra <strong>Inserir → Suplementos → Meus Suplementos</strong>{" "}
            e clique em <strong>Fazer Upload de Meu Suplemento</strong>.
          </li>
          <li>
            Informe a URL do manifesto:{" "}
            <code>{MANIFEST_URL}</code>
          </li>
          <li>Confirme e aguarde o painel do Robbie abrir na lateral do documento.</li>
          <li>Faça login com o mesmo e-mail usado no cadastro.</li>
        </ol>

        <p className="install-note">
          Word Online (web): o mesmo menu de suplementos fica em{" "}
          <strong>Inserir → Suplementos</strong>. Word para Mac usa o fluxo
          idêntico ao do Windows.
        </p>

        <a className="btn btn-primary" href={MANIFEST_URL} target="_blank" rel="noreferrer">
          Baixar manifesto
        </a>
        <a className="btn btn-secondary" href="/contato">
          Precisa de ajuda?
        </a>
      </section>
    </main>
  );
}
