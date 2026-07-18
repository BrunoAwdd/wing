import { LegalPage } from "../components/LegalPage";

export function TermsOfUse() {
  return (
    <LegalPage title="Termos de Uso" updatedAt="17 de julho de 2026">
      <h2>1. Aceitação e responsável</h2>
      <p>
        Estes termos regulam o uso do Robbie, operado por
        <strong> [RAZÃO SOCIAL]</strong>, CNPJ <strong>[CNPJ]</strong>. Ao criar
        uma conta ou usar o serviço, você declara ter capacidade para contratar
        e concorda com estes termos e com a Política de Privacidade.
      </p>

      <h2>2. Serviço</h2>
      <p>
        O Robbie oferece revisão, reescrita, tradução, resumo e conversa com
        documentos dentro do Microsoft Word. Funcionalidades podem variar por
        plano, ambiente, modelo de IA e compatibilidade da versão do Word.
      </p>

      <h2>3. Conta e segurança</h2>
      <p>
        Você deve fornecer informações corretas, proteger o acesso ao e-mail e
        comunicar uso não autorizado. A conta não pode ser revendida, cedida ou
        utilizada para contornar limites técnicos ou comerciais.
      </p>

      <h2>4. Planos, créditos e teste</h2>
      <ul>
        <li>o teste oferece 500 créditos por uma única vez e expira em 30 dias;</li>
        <li>o Basic oferece 3.500 créditos por mês;</li>
        <li>o Pro oferece 8.000 créditos por mês e níveis adicionais de qualidade;</li>
        <li>créditos medem o processamento de IA e variam conforme texto, resposta e modelo;</li>
        <li>créditos não utilizados não acumulam nem são convertidos em dinheiro.</li>
      </ul>

      <h2>5. Cobrança e cancelamento</h2>
      <p>
        Assinaturas são processadas pela Stripe no ciclo escolhido. O plano anual
        é cobrado antecipadamente pelo valor indicado no checkout. Você pode
        cancelar a renovação pelo portal de cobrança; o acesso pago permanece até
        o fim do período já contratado, salvo hipótese legal ou informação diversa no checkout.
      </p>
      <p>
        Reembolsos, arrependimento e cobranças indevidas serão tratados conforme
        a legislação aplicável e pelo canal <strong>[E-MAIL DE SUPORTE]</strong>.
      </p>

      <h2>6. Conteúdo e uso permitido</h2>
      <p>
        Você mantém os direitos sobre seus documentos e declara possuir base
        legítima para processá-los. É proibido usar o serviço para violar direitos,
        produzir abuso, tentar acessar contas alheias, comprometer a infraestrutura
        ou automatizar consumo de forma incompatível com o plano.
      </p>

      <h2>7. Limitações da inteligência artificial</h2>
      <p>
        Respostas podem conter erros, omissões ou informações inadequadas. O
        Robbie não substitui revisão humana nem aconselhamento jurídico,
        financeiro, médico ou profissional. Você decide se aceita uma sugestão e
        é responsável pela versão final do documento.
      </p>

      <h2>8. Disponibilidade e alterações</h2>
      <p>
        Podemos realizar manutenção, corrigir falhas, alterar modelos e evoluir
        funcionalidades. Mudanças materiais de preço ou condições serão
        informadas antes de produzirem efeito sobre nova cobrança.
      </p>

      <h2>9. Suspensão e encerramento</h2>
      <p>
        Podemos limitar ou suspender contas em caso de fraude, inadimplência,
        risco à segurança ou violação destes termos, preservados os direitos
        obrigatórios do consumidor. Você pode solicitar encerramento da conta.
      </p>

      <h2>10. Lei e foro</h2>
      <p>
        Aplicam-se as leis brasileiras. Fica eleito o foro de
        <strong> [CIDADE/UF]</strong>, sem prejuízo do foro assegurado ao consumidor.
      </p>
    </LegalPage>
  );
}
