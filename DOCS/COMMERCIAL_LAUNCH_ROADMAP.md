# Roadmap de Lançamento Comercial do Wing

**Status:** Ativo

**Atualizado em:** 2026-07-12

**Escopo:** transformar o núcleo comercial definido no RFC 014 em um produto vendável e operável.

## 1. Regras de escopo

- Manter revisão, reescrita, tradução, resumo, histórico, memória local e Fale com o documento.
- Manter Visual Law e análise jurídica desligados.
- Não reintroduzir Agents, Maestro, Extensions de agents ou MCP.
- Tratar o backend como fonte de verdade para identidade, plano, assinatura e cota.
- Nenhum evento, log ou métrica pode conter texto do documento.

## 2. Milestones

| Ordem | Milestone | Estado | Dependência | Resultado comercial |
|---|---|---|---|---|
| M0 | Retirada do runtime aposentado | Concluído | - | Produto sem Agents, Maestro, Extensions ou MCP |
| M1 | Identidade e sessão Wing | Em validação | M0 | Usuário autenticado de forma confiável |
| M2 | Stripe, planos e cotas | Pendente | M1 | Wing pode cobrar e aplicar Free/Pro |
| M3 | Chat com entitlement e histórico íntegro | Pendente | M1, M2 | Conversa segura e consistente |
| M4 | Telemetria segura e confiável | Pendente | M1 | Métricas utilizáveis sem expor documentos |
| M5 | Empacotamento e ambiente de produção | Pendente | M1-M4 | Add-in instalável fora do ambiente de dev |
| M6 | Quality gate e piloto pago | Pendente | M1-M5 | Liberação controlada para clientes |

## M0 - Retirada do runtime aposentado

Entregáveis:

- [x] remover rotas de Agents e Maestro;
- [x] remover APIs e inicialização de Extensions;
- [x] remover router MCP;
- [x] excluir serviços e manifests exclusivos;
- [x] remover a dependência `json5`, usada somente por Agents;
- [x] adicionar migration idempotente para remover a tabela `agents` legada;
- [x] adicionar testes garantindo `404` para os endpoints aposentados.

Gate de saída: nenhuma referência executável a `agentsService`, `maestroService`, `extensionRegistry`, `mcpRoutes` ou `SYSTEM_TOOLS_MANIFEST`.

## M1 - Identidade e sessão Wing

Entregáveis:

- [x] validar o token Microsoft por assinatura, emissor, audiência e expiração;
- [x] emitir sessão Wing assinada e curta após o SSO;
- [x] criar middleware único de sessão para as APIs comerciais;
- [x] unificar o login das configurações com o token usado por revisão e chat;
- [x] remover login `admin/password`, tokens dummy em produção e RBAC por header;
- [x] remover tokens completos de logs e telemetria;
- [x] definir logout, expiração e renovação controlada.
- [ ] executar smoke SSO com uma conta real no Word.

Implementado em 2026-07-12. A sessão fica somente em memória, é renovada pelo
Office SSO antes da expiração e não possui refresh token próprio.

Gate de saída:

- token Microsoft forjado ou expirado retorna `401`;
- sessão Wing expirada retorna `401` em todas as APIs comerciais;
- nenhuma rota administrativa confia em dados de autorização enviados pelo cliente;
- testes cobrem sucesso, expiração, audiência incorreta e assinatura inválida.

## M2 - Stripe, planos e cotas

Entregáveis:

- [ ] implementar `GET /api/v1/billing/status`;
- [ ] implementar `POST /api/v1/billing/checkout`;
- [ ] implementar `POST /api/v1/billing/portal`;
- [ ] implementar webhook Stripe com corpo bruto, assinatura e idempotência;
- [ ] mapear estados Stripe para entitlement Free/Pro;
- [ ] implementar incremento atômico e bloqueio da cota Free;
- [ ] exibir plano, uso, limite, checkout e portal nas configurações;
- [ ] registrar métricas de checkout, conversão e falha sem dados sensíveis.

Gate de saída:

- checkout de teste promove a conta para Pro somente depois do webhook;
- cancelamento ou inadimplência remove o entitlement Pro;
- cota Free é aplicada antes da chamada ao provedor de IA;
- retries de webhook não duplicam assinatura nem consumo.

## M3 - Chat com entitlement e histórico íntegro

Entregáveis:

- [ ] exigir sessão Wing em `/chat/start` e `/chat/message`;
- [ ] revalidar entitlement e cota a cada mensagem;
- [ ] acumular a resposta completa do stream no histórico do modelo;
- [ ] limitar tamanho inicial do documento, mensagens e duração da sessão;
- [ ] contabilizar uso do chat na mesma política das demais ações;
- [ ] cobrir expiração, revogação, multi-turn e stream interrompido.

Gate de saída: uma conta revogada não envia novas mensagens e uma conversa multi-turn preserva pares completos de usuário/modelo.

## M4 - Telemetria segura e confiável

Entregáveis:

- [ ] definir catálogo tipado e allowlist de eventos;
- [ ] definir propriedades permitidas por evento;
- [ ] rejeitar campos livres, texto do documento e payloads acima do limite;
- [ ] aplicar autenticação quando houver identidade e rate limit para eventos anônimos;
- [ ] manter o backend como emissor canônico de eventos de conclusão e consumo;
- [ ] remover duplicidade de `prompt_sent` entre frontend e backend;
- [ ] trocar mensagens de erro livres por códigos normalizados;
- [ ] tornar a aplicação das migrations repetível em ambientes novos.

Gate de saída: testes tentam enviar texto e propriedades desconhecidas e comprovam que nada disso é persistido.

## M5 - Empacotamento e ambiente de produção

Entregáveis:

- [ ] criar manifesto de produção com URLs, ícones, suporte e SSO definitivos;
- [ ] remover `localhost` e cliente de HMR do artefato implantado;
- [ ] alinhar `BACKEND_URL`, CORS e domínios autorizados;
- [ ] separar e documentar configurações de dev, staging e produção;
- [ ] validar certificados, secrets, health check e observabilidade;
- [ ] executar smoke test no Word Windows, Mac e Web.

Gate de saída: o pacote instalado em uma máquina limpa abre o Wing, autentica e conclui uma ação sem depender de infraestrutura local.

## M6 - Quality gate e piloto pago

Entregáveis:

- [ ] excluir artefatos gerados do lint e zerar erros no código mantido;
- [ ] criar CI para check, testes, build, lint e validação do manifesto;
- [ ] cobrir auth, billing, quota, chat e telemetria com testes de integração;
- [ ] criar roteiro manual para interações reais com o Word;
- [ ] executar revisão de segurança e privacidade;
- [ ] documentar rollback, suporte e operação do piloto;
- [ ] liberar primeiro para um grupo pequeno de clientes pagantes.

Gate de saída: todos os checks são bloqueantes no CI e o piloto possui responsável, métricas, suporte e rollback definidos.

## 3. Ordem recomendada

1. Executar M1 antes de qualquer integração de pagamento.
2. Construir M2 sobre a sessão Wing, sem aceitar e-mail ou plano enviados pelo frontend.
3. Fechar M3 e M4 em paralelo depois que a identidade estiver estável.
4. Consolidar M5 somente com contratos de API definidos.
5. Usar M6 como gate de lançamento, não como backlog posterior.

## 4. Itens deliberadamente adiados

- recuperação semântica local no Fale com o documento;
- Visual Law e análise jurídica;
- AppSource público;
- planos Team e Enterprise;
- múltiplos provedores configuráveis pelo usuário.

A recuperação local do chat é uma evolução de privacidade e custo, mas o RFC 014 permite o envio inicial do documento completo ao backend. Ela não bloqueia o primeiro piloto desde que os limites e consentimentos estejam claros.
