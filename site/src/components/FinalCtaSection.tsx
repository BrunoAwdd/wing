import { SignupFlow } from "./SignupFlow";

export function FinalCtaSection() {
  return (
    <section className="section" id="cadastro">
      <div className="container">
        <div className="final-cta">
          <div>
            <h2>Teste o Robbie gratuitamente</h2>
            <p>Crie sua conta com o e-mail profissional. Sem cartão de crédito.</p>
          </div>
          <SignupFlow />
        </div>
      </div>
    </section>
  );
}
