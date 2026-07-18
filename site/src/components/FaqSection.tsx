const FAQ_ITEMS = [
  {
    question: "O Robbie funciona dentro do Word?",
    answer:
      "Sim. O Robbie é um suplemento do Microsoft Word e aparece como um painel lateral dentro do próprio documento.",
  },
  {
    question: "Preciso copiar o texto para outra plataforma?",
    answer:
      "Não. Você seleciona o trecho no Word e o Robbie trabalha em cima dele, sem precisar levar o conteúdo para outro lugar.",
  },
  {
    question: "Posso revisar contratos e petições?",
    answer:
      "Sim, o Robbie pode revisar, reescrever e resumir qualquer documento de texto do Word, incluindo contratos e petições.",
  },
  {
    question: "O que é um crédito?",
    answer:
      "Crédito é a unidade que mede o custo de cada ação de IA no Robbie. Como referência, para um parágrafo de aproximadamente 100 palavras: traduzir custa cerca de 1 crédito, resumir cerca de 2 créditos, revisar cerca de 4 créditos e reescrever no nível padrão cerca de 6 créditos. Ou seja, com os 500 créditos do teste grátis dá para fazer, por exemplo, cerca de 500 traduções, 250 resumos, 125 revisões ou 80 reescritas de parágrafo — ou uma combinação entre elas. Textos maiores consomem proporcionalmente mais créditos, e o nível de qualidade Profundo (disponível nos planos pagos) custa mais que o nível padrão.",
  },
  {
    question: "Como funcionam os créditos?",
    answer:
      "Cada ação (revisar, reescrever, traduzir, resumir ou conversar) consome créditos. No teste grátis, os 500 créditos são únicos e não renovam. Nos planos pagos, os créditos são renovados todo mês.",
  },
  {
    question: "Existe uma versão gratuita?",
    answer:
      "Existe um teste grátis com 500 créditos, válido por 30 dias ou até acabarem os créditos, sem cartão de crédito. Não é um plano gratuito recorrente — depois do teste, é preciso assinar Basic ou Pro para continuar usando.",
  },
  {
    question: "O Robbie substitui a revisão humana?",
    answer:
      "Não. O Robbie sugere alterações, mas você decide o que aceitar — a revisão final continua sendo sua.",
  },
  {
    question: "Meus documentos ficam armazenados?",
    answer:
      "O conteúdo do documento é processado para responder à ação solicitada durante a sua sessão, sem virar um repositório separado dos seus arquivos.",
  },
  {
    question: "Funciona para equipes?",
    answer:
      "O plano para escritórios está em construção. Enquanto isso, cada pessoa pode usar o Robbie com sua própria conta.",
  },
];

export function FaqSection() {
  return (
    <section className="section" id="faq">
      <div className="container">
        <div className="section-header">
          <span className="eyebrow">Perguntas frequentes</span>
          <h2 className="section-title">Ainda com dúvidas?</h2>
        </div>
        <div className="faq-list">
          {FAQ_ITEMS.map((item) => (
            <details className="faq-item" key={item.question}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
