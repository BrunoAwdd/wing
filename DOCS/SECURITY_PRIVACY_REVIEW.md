# Revisão de Segurança e Privacidade para Lançamento

**Data:** 2026-07-17  
**Escopo:** site, add-in Word, API, Supabase, Stripe e provedores de IA  
**Status:** condicional; não aprovado para produção enquanto houver itens P0

## 1. Fluxos de dados confirmados

| Fluxo | Dados | Destino | Persistência |
|---|---|---|---|
| Cadastro | e-mail, nome, tokens de sessão | Supabase/Wing | conta e hashes de refresh token |
| Ações de IA | texto selecionado, comando e resposta | backend e provedor escolhido | não gravado no banco Wing; sujeito ao processamento do provedor |
| Fale com o documento | documento, pergunta e histórico | backend e provedor escolhido | conversa local; cache remoto limitado pela app session |
| Memória | índice e identificador do documento | navegador/Office | IndexedDB e configurações do documento |
| Telemetria | eventos, contagens, latência, modelo e créditos | Supabase/Wing | `telemetry_events`, sem texto livre |
| Billing | e-mail, plano, status, nome, CPF/CNPJ e endereço | Stripe | Stripe; Wing guarda apenas IDs, plano e status |

## 2. Controles verificados

- sessão Wing assinada, curta e renovável;
- refresh token armazenado como hash no backend;
- APIs comerciais exigem autenticação e revalidam entitlement;
- reserva atômica de créditos antes da chamada de IA;
- rate limit em autenticação e telemetria;
- CORS por allowlist, com rejeição de wildcard, `null` e origens de desenvolvimento em produção;
- catálogo fechado de telemetria, limite de payload e proibição de texto livre;
- webhook Stripe validado por assinatura e idempotente;
- payload Stripe removido da persistência de idempotência;
- recursos imaturos desligados por feature flag.

## 3. Achados

### P0 - Bloqueiam lançamento

- [ ] preencher razão social, CNPJ, endereço, contato de suporte, contato de privacidade e foro nos documentos públicos;
- [ ] definir domínio oficial e substituir URLs temporárias em site, CORS e manifesto;
- [ ] configurar secrets e quatro Price IDs live no ambiente de produção;
- [ ] aplicar migrations pendentes em produção, incluindo plano Basic, trial e remoção de payload de webhook;
- [ ] validar contratos/configurações de retenção e uso de dados de Google, OpenAI e Anthropic para API comercial;
- [ ] executar checkout e webhook reais em Stripe Test Mode, cobrindo mensal, anual, cancelamento e inadimplência;
- [ ] confirmar com contador o emissor de NFS-e, campos obrigatórios e rotina de emissão.

### P1 - Obrigatórios durante o piloto

- [ ] criar processo autenticado para acesso, correção e exclusão de conta;
- [ ] definir prazos formais de retenção para telemetria, contas encerradas e registros de suporte;
- [ ] revisar logs de produção e garantir que erros de SDK não incluam prompts ou payloads;
- [ ] adicionar monitoramento de falhas de login, IA, webhook, cota e latência sem conteúdo documental;
- [ ] registrar responsáveis por incidente de segurança e comunicação a titulares/ANPD quando aplicável.

### P2 - Evolução

- [ ] reduzir o chat para enviar apenas trechos recuperados localmente;
- [ ] criar inventário versionado de operadores/suboperadores;
- [ ] automatizar testes de vazamento de texto em logs e telemetria;
- [ ] oferecer exclusão explícita dos caches locais pelo usuário.

## 4. Divergências de comunicação

RFCs antigos usam expressões como “privacidade absoluta”, “tudo local” e “nenhum
texto em servidor”. Elas não descrevem o produto comercial atual: ações de IA
exigem transmissão ao backend/provedor e o chat pode enviar o documento inteiro.
Esses RFCs são históricos e não podem ser usados como material comercial.

## 5. Critério de aprovação

A revisão passa quando todos os P0 estiverem concluídos, os P1 tiverem responsável
e prazo dentro do piloto, e um smoke test comprovar autenticação, cobrança, cota,
processamento de IA, cancelamento e exclusão sem conteúdo documental em logs.

## 6. Referências

- [LGPD - Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [Direitos dos titulares - ANPD](https://www.gov.br/anpd/pt-br/assuntos/direitos-dos-titulares)
- [Comunicação de incidente - ANPD](https://www.gov.br/anpd/pt-br/assuntos/incidente-de-seguranca)
- [NFS-e Nacional](https://www.gov.br/pt-br/servicos/emitir-nota-fiscal-de-servico-eletronica)

