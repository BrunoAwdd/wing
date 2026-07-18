import { LegalPage } from "../components/LegalPage";

export function PrivacyPolicy() {
  return (
    <LegalPage title="Política de Privacidade" updatedAt="17 de julho de 2026">
      <h2>1. Quem somos</h2>
      <p>
        O Robbie é um assistente de documentos para Microsoft Word operado por
        <strong> [RAZÃO SOCIAL]</strong>, inscrita no CNPJ sob o nº
        <strong> [CNPJ]</strong>, com sede em <strong>[ENDEREÇO]</strong>. Para
        assuntos de privacidade, use <strong>[E-MAIL DE PRIVACIDADE]</strong>.
      </p>

      <h2>2. Dados tratados</h2>
      <ul>
        <li>conta: e-mail, nome, identificadores e dados de sessão;</li>
        <li>assinatura: plano, status, consumo de créditos e identificadores Stripe;</li>
        <li>faturamento: nome ou razão social, CPF/CNPJ e endereço informados no checkout;</li>
        <li>uso: ações realizadas, contagens, modelo utilizado, duração, falhas e créditos;</li>
        <li>atendimento: nome, e-mail, assunto e mensagem enviados pelo formulário de contato;</li>
        <li>conteúdo: trechos, documentos, comandos e respostas necessários para executar a ação solicitada.</li>
      </ul>

      <h2>3. Como usamos os dados</h2>
      <p>
        Usamos os dados para autenticar contas, prestar as funcionalidades,
        processar pagamentos, emitir documentos fiscais, aplicar limites,
        prevenir abuso, oferecer suporte e melhorar segurança e desempenho.
      </p>

      <h2>4. Documentos e inteligência artificial</h2>
      <p>
        O conteúdo escolhido pelo usuário é transmitido ao backend e ao provedor
        de IA necessário para produzir a resposta. No “Fale com o documento”, o
        documento aberto pode ser enviado integralmente para criar o contexto da
        conversa. O Robbie não usa texto de documentos em sua telemetria.
      </p>
      <p>
        Conversas e índices de memória também podem ser mantidos localmente no
        dispositivo. Caches remotos de contexto podem existir durante a sessão,
        com duração técnica limitada, para reduzir custo e latência.
      </p>

      <h2>5. Compartilhamento e transferências</h2>
      <p>
        Podemos utilizar fornecedores de autenticação e banco de dados, Stripe
        para pagamentos, Microsoft para integração com o Word, Cloudflare para
        entrega e proteção, e Google, OpenAI ou Anthropic para processamento de
        IA. Esses fornecedores podem processar dados fora do Brasil conforme
        seus contratos e mecanismos legais aplicáveis.
      </p>

      <h2>6. Retenção</h2>
      <ul>
        <li>conteúdo de documentos não é gravado no banco operacional do Robbie;</li>
        <li>caches e sessões possuem expiração técnica;</li>
        <li>dados de conta permanecem durante a relação e pelo prazo necessário ao cumprimento legal;</li>
        <li>registros financeiros e fiscais seguem os prazos legais aplicáveis;</li>
        <li>dados locais permanecem no dispositivo até expiração, limpeza ou remoção do suplemento.</li>
      </ul>

      <h2>7. Bases legais e direitos</h2>
      <p>
        O tratamento pode ocorrer para executar o contrato, cumprir obrigações
        legais, proteger o serviço e atender interesses legítimos compatíveis.
        O titular pode solicitar confirmação, acesso, correção, informação sobre
        compartilhamento, portabilidade, oposição ou exclusão quando aplicável.
      </p>

      <h2>8. Segurança</h2>
      <p>
        Aplicamos controle de acesso, sessões com expiração, limitação de taxa,
        validação de origem, segregação por conta e minimização de telemetria.
        Nenhum sistema é absolutamente seguro; incidentes relevantes serão
        tratados conforme a legislação aplicável.
      </p>

      <h2>9. Contato e alterações</h2>
      <p>
        Pedidos de privacidade devem ser enviados ao canal indicado na seção 1.
        Alterações relevantes nesta política serão comunicadas no site ou no produto.
      </p>
    </LegalPage>
  );
}
