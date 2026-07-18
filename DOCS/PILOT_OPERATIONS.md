# Operação, Suporte e Rollback do Piloto Pago

**Status:** rascunho operacional  
**Responsável do piloto:** [NOME]  
**Canal de suporte:** [E-MAIL/WHATSAPP]  
**Canal de incidentes:** [E-MAIL/TELEFONE]

## 1. Escopo do piloto

- grupo inicial: 5 a 10 clientes pagantes convidados;
- planos: Basic e Pro, mensal ou anual;
- plataformas: definir entre Word Windows, Mac e Web após smoke test;
- recursos ativos: revisão, reescrita, tradução, resumo, memória local e chat;
- recursos desligados: Visual Law e análise jurídica.

## 2. Entrada de cliente

1. confirmar aceite dos Termos e ciência da Política de Privacidade;
2. concluir cadastro e checkout;
3. confirmar plano ativo pelo webhook, nunca apenas pelo retorno do navegador;
4. fornecer instalação do add-in e roteiro inicial;
5. registrar responsável, plano, data de início e canal de contato.

## 3. Suporte

| Severidade | Exemplo | Primeira resposta | Atualização |
|---|---|---:|---:|
| S1 | cobrança indevida, vazamento ou indisponibilidade geral | 1 hora | a cada 2 horas |
| S2 | login, checkout ou ação principal indisponível para um cliente | 4 horas úteis | diária |
| S3 | erro contornável ou dúvida de uso | 1 dia útil | conforme avanço |

Todo chamado registra conta, ambiente, horário, endpoint/ação e código de erro.
Nunca solicitar documento, prompt, resposta de IA, token, CPF/CNPJ ou chave secreta
por e-mail ou mensagem. Quando reprodução exigir conteúdo, usar documento sintético.

## 4. Métricas diárias

- cadastro iniciado e concluído;
- checkout iniciado, concluído e falho por plano/ciclo;
- contas ativas e conversão;
- créditos consumidos e custo por provedor/modelo;
- sucesso, falha, latência e interrupção por ação;
- volume e severidade de chamados;
- cancelamentos, inadimplência e reembolsos.

## 5. Rotina

### Diária

- verificar health check, erros S1/S2, webhooks falhos e saldo/custo anormal;
- responder clientes e registrar decisões;
- confirmar que logs e telemetria não contêm texto documental.

### Semanal

- revisar conversão, margem, P50/P90 de consumo e principais falhas;
- entrevistar ao menos dois usuários;
- decidir manter, corrigir, desligar ou expandir o piloto.

## 6. Rollback

### Aplicação

1. congelar novas implantações e identificar a última versão saudável;
2. reimplantar o artefato anterior sem alterar dados;
3. validar health, login e uma ação com documento sintético;
4. comunicar impacto e previsão aos participantes.

### Funcionalidade

- desligar recurso por feature flag quando disponível;
- em falha de provedor, desabilitar o modelo afetado ou usar fallback apenas conforme política do ambiente;
- em custo anormal, reduzir limite, bloquear nova reserva e preservar saldos já registrados.

### Billing

- pausar novos checkouts se webhook ou sincronização de plano estiver inconsistente;
- não apagar eventos ou assinaturas manualmente antes de reconciliar Stripe e Supabase;
- reembolso/cancelamento deve ser executado na Stripe e confirmado pelo webhook;
- exportar IDs de evento, assinatura e conta sem incluir dados fiscais em chamados.

### Banco

- migrations de produção são aditivas e possuem backup antes da aplicação;
- rollback destrutivo exige restauração testada e aprovação do responsável;
- nunca usar banco local como evidência de produção.

## 7. Incidente de privacidade

1. interromper o fluxo que causa exposição;
2. preservar evidências sem replicar o conteúdo exposto;
3. identificar dados, titulares, duração e terceiros envolvidos;
4. acionar responsável de privacidade e avaliar comunicação legal;
5. corrigir, validar e registrar post-mortem sem dados pessoais.

## 8. Saída do piloto

O piloto pode expandir quando não houver P0 aberto, custos estiverem dentro da
margem, S1 for zero no período acordado, S2 tiver solução conhecida e houver
evidência de uso recorrente e disposição de pagamento.

