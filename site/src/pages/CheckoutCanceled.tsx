export function CheckoutCanceled() {
  return (
    <main className="page">
      <section className="signup-card" role="status">
        <h2>Assinatura não concluída</h2>
        <p>
          O pagamento foi cancelado e nada foi cobrado. Você pode tentar de
          novo quando quiser, direto na seção de preços.
        </p>
        <a className="btn btn-primary" href="/#precos">
          Ver planos
        </a>
      </section>
    </main>
  );
}
