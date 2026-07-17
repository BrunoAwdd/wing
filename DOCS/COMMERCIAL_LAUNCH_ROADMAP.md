# Roadmap de Lançamento Comercial do Wing

**Status:** Ativo

**Atualizado em:** 2026-07-14

**Escopo:** transformar o núcleo comercial definido no RFC 014 em um produto vendável e operável.

## 1. Regras de escopo

- Manter revisão, reescrita, tradução, resumo, histórico, memória local e Fale com o documento.
- Manter Visual Law e análise jurídica desligados.
- Não reintroduzir Agents, Maestro, Extensions de agents ou MCP.
- Tratar o backend como fonte de verdade para identidade, plano, assinatura e cota.
- Nenhum evento, log ou métrica pode conter texto do documento.

## 2. Milestones

| Ordem | Milestone                                | Estado       | Dependência  | Resultado comercial                                   |
| ----- | ---------------------------------------- | ------------ | ------------ | ----------------------------------------------------- |
| M0    | Retirada do runtime aposentado           | Concluído    | -            | Produto sem Agents, Maestro, Extensions ou MCP        |
| M1    | Identidade e sessão Wing                 | Em validação | M0           | Usuário autenticado de forma confiável                |
| M2    | Stripe, planos e cotas                   | Concluído    | M1           | Wing pode cobrar e aplicar Free/Pro                   |
| M3    | Chat com entitlement e histórico íntegro | Concluído    | M1, M2       | Conversa segura e consistente                         |
| M4    | Telemetria segura e confiável            | Concluído    | M1           | Métricas utilizáveis sem expor documentos             |
| M4.4  | Carteira mensal de créditos              | Concluído    | M2-M4        | Custo de IA controlado por conta e modelo             |
| M4.5  | Cache do Fale com o documento            | Concluído    | M3, M4.4     | Conversas contínuas com menor custo de contexto       |
| M4.6  | Sessão por instância do Word             | Concluído    | M1, M3, M4.5 | Documentos abertos isolados sem licença por assento   |
| M4.7  | Ciclo e cobrança do cache                 | Concluído    | M4.4-M4.6    | Cache sustentável com economia visível ao cliente    |
| M4.8  | DDD e arquitetura hexagonal               | Concluído    | M4.7         | Núcleo comercial testável e independente de vendors  |
| M5    | Empacotamento e ambiente de produção     | Em andamento | M1-M4.8      | Add-in instalável fora do ambiente de dev             |
| M5.1  | Site comercial e cadastro                | Pendente     | M1, M2, M5   | Visitante conhece o Wing e cria sua conta             |
| M6    | Quality gate e piloto pago               | Pendente     | M1-M5.1      | Liberação controlada para clientes                    |
| M7    | Enterprise                               | Futuro       | M6           | Governança, múltiplas contas e controle de alterações |

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

- [x] implementar `GET /api/v1/billing/status`;
- [x] implementar `POST /api/v1/billing/checkout`;
- [x] implementar `POST /api/v1/billing/portal`;
- [x] implementar webhook Stripe com corpo bruto, assinatura e idempotência;
- [x] mapear estados Stripe para entitlement Free/Pro;
- [x] implementar incremento atômico e bloqueio da cota Free;
- [x] exibir plano, uso, limite, checkout e portal nas configurações;
- [x] registrar métricas de checkout, conversão e falha sem dados sensíveis.

Concluído em 2026-07-13. A migration e a função de consumo atômico foram
validadas no Supabase local. O teste de integração da RPC comprovou incremento
dentro do limite e bloqueio sem consumo adicional após o limite. Os eventos de
assinatura possuem métricas distintas para início, atualização, cancelamento,
pausa e retomada. A suíte encerrou com 42 testes aprovados; o teste de banco é
opt-in por depender da infraestrutura local.

O smoke test completo no Stripe Test Mode será executado na preparação do
ambiente que possuir `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` e
`STRIPE_PRICE_PRO`. Essa validação operacional não reabre a implementação do
milestone.

Gate de saída:

- checkout de teste promove a conta para Pro somente depois do webhook;
- cancelamento ou inadimplência remove o entitlement Pro;
- cota Free é aplicada antes da chamada ao provedor de IA;
- retries de webhook não duplicam assinatura nem consumo.

## M3 - Chat com entitlement e histórico íntegro

Entregáveis:

- [x] exigir sessão Wing em `/chat/start` e `/chat/message`;
- [x] revalidar entitlement e cota a cada mensagem;
- [x] acumular a resposta completa do stream no histórico do modelo;
- [x] limitar tamanho inicial do documento, mensagens e duração da sessão;
- [x] contabilizar uso do chat na mesma política das demais ações;
- [x] cobrir expiração, revogação, multi-turn e stream interrompido.

Concluído em 2026-07-13. Cada mensagem reserva cota atomicamente antes de
chamar o provedor e revalida o plano e a revogação da conta. O lock da sessão é
adquirido antes das consultas assíncronas, impedindo streams concorrentes. As
sessões possuem duração absoluta, remoção automática, ownership por conta e
limites de documento, mensagem e quantidade. O histórico só mantém pares
completos de usuário/modelo; uma interrupção restaura o snapshot anterior no
backend e remove as mensagens otimistas no frontend. Testes dedicados cobrem
autenticação, conta revogada, concorrência, expiração automática, entitlement
sem cota, multi-turn, interrupção e limites. A suíte completa encerrou com 57
testes aprovados e o build do add-in passou.

Gate de saída: uma conta revogada não envia novas mensagens e uma conversa multi-turn preserva pares completos de usuário/modelo.

## M4 - Telemetria segura e confiável

Entregáveis:

- [x] definir catálogo tipado e allowlist de eventos;
- [x] definir propriedades permitidas por evento;
- [x] rejeitar campos livres, texto do documento e payloads acima do limite;
- [x] aplicar autenticação quando houver identidade e rate limit para eventos anônimos;
- [x] manter o backend como emissor canônico de eventos de conclusão e consumo;
- [x] remover duplicidade de `prompt_sent` entre frontend e backend;
- [x] trocar mensagens de erro livres por códigos normalizados;
- [x] tornar a aplicação das migrations repetível em ambientes novos.

Concluído em 2026-07-13. O catálogo distingue eventos de cliente e servidor,
valida exatamente nomes, propriedades, tipos, enums e limites, e impede que o
frontend falsifique eventos canônicos. Erros usam códigos fechados, sem
`Error.message`. A ingestão vincula sessões válidas e limita eventos anônimos
por IP. O Postgres replica a allowlist e o limite de payload como defesa em
profundidade; a migration saneia registros legados e foi reaplicada com
sucesso. Testes tentam enviar nome desconhecido, texto do documento, campos
extras, evento server-only e payload excessivo sem persistência. No smoke real,
o evento válido incrementou a tabela e o evento com `documentText` retornou
`400` sem alterar a contagem. A suíte encerrou com 65 testes aprovados e o build
do add-in passou.

Gate de saída: testes tentam enviar texto e propriedades desconhecidas e comprovam que nada disso é persistido.

## M4.4 - Carteira mensal de créditos

Entregáveis:

- [x] definir um pote mensal único de créditos por conta e plano;
- [x] definir tarifas relativas de entrada e saída por família de modelo;
- [x] reservar créditos atomicamente antes de chamar o provedor;
- [x] incluir prompt completo e histórico na reserva;
- [x] liquidar a reserva com créditos, modelo e tokens estimados ao encerrar o stream;
- [x] tornar a liquidação idempotente e liberar reserva em falha de inicialização;
- [x] expor créditos usados, limite e quantidade de solicitações no billing;
- [x] validar as RPCs contra o Supabase local e executar a suíte completa.

Concluído em 2026-07-13. Tokens são uma unidade técnica interna; comercialmente,
o usuário recebe uma carteira mensal única de créditos. Toda ação e mensagem de
chat reserva créditos do mesmo saldo antes da IA. O débito varia por modelo e
pelos tokens estimados de entrada e saída, com tarifa conservadora para modelos
desconhecidos. Cada transação registra modelo, tokens e créditos, e sua
liquidação é idempotente. O billing e a configuração expõem somente o saldo de
créditos. A migration foi reaplicada com sucesso e o teste real contra o
Postgres comprovou bloqueio concorrente e ausência de cobrança duplicada.
A tabela inicial cobre Gemini Flash 3.5; GPT 5.6 Luna, Terra e Sol; e Claude
Sonnet 5, Opus 4.8 e Fable. Claude Haiku possui tarifa cadastrada, mas permanece
fora da oferta inicial.
Traduções são roteadas para Gemini 2.5 Flash-Lite e debitam 1 crédito por mil
tokens de entrada e 2 créditos por mil tokens de saída.
A suíte encerrou com 70 testes aprovados, além do teste opt-in de banco, e o
build do add-in passou.

Gate de saída: chamadas concorrentes não ultrapassam a cota, uma tentativa
bloqueada não chama a IA e a liquidação repetida não duplica nem reduz consumo.

## M4.5 - Cache do Fale com o documento

Entregáveis:

- [x] implementar cache local da conversa por documento, com restauração, TTL e limpeza manual;
- [x] implementar cache contextual do Wing com últimas mensagens e resumo compacto do histórico;
- [x] implementar cache de prompt em Gemini, GPT e Claude, respeitando o mecanismo de cada provedor, com hash ou prefixo estável, TTL, invalidação e métricas de economia.

O prefixo estável formado por instruções e documento deve ser separado das
perguntas e respostas variáveis. O cache é isolado por conta, documento, modelo
e versão do prompt (desde o M4.6, também pela app session — ver abaixo).
Metadados podem ser persistidos, mas nenhum registro do Wing deve armazenar o
texto jurídico usado pelo cache remoto.

Gate de saída: reabrir o painel restaura a conversa, uma nova sessão reconstrói
o contexto sem reenviar histórico ilimitado e perguntas consecutivas sobre um
documento inalterado comprovam cache hit no provedor. Alterar documento, modelo
ou versão do prompt invalida o cache.

## M4.6 - Sessão por instância do Word

Entregáveis:

- [x] criar `appSessionId` por instância aberta do Word, independente da sessão de login;
- [x] vincular cada app session ao documento aberto, ao chat e aos caches correspondentes;
- [x] implementar heartbeat, expiração e encerramento sem limitar dispositivos, pessoas ou sessões por conta;
- [x] remover `WING_CHAT_MAX_SESSIONS_PER_ACCOUNT` como regra comercial;
- [x] manter todas as app sessions debitando a mesma carteira da conta proprietária;
- [x] Basta um único refresh token para manter todas as sessões vivas. (No mesmo computador)

Três documentos abertos representam três app sessions. O mesmo documento
aberto em dois computadores representa duas app sessions. A sessão Wing segue
responsável somente por autenticação; a app session isola a instância do Word;
a chat session representa a conversa; e a carteira permanece única por conta.

Concluído em 2026-07-14. `appSessionId` é gerado pelo backend a cada
`POST /api/v1/app-sessions`, nunca persistido no documento nem derivado de
`wing_doc_id` (que identifica o arquivo, não a instância). O frontend registra
a instância ao abrir o painel, envia heartbeat a cada 3 minutos e tenta
encerrar a app session no fechamento (best-effort, já que o Office.js não
garante executar JS no encerramento de todas as instâncias do Word) — quem de
fato garante o fim de uma instância fechada é o TTL do servidor
(`WING_APP_SESSION_TTL_MS`, 10 minutos por padrão) expirando por falta de
heartbeat. `/chat/start` e `/chat/message` exigem o cabeçalho
`X-Wing-App-Session` e revalidam a cada mensagem, não só na criação — assim
fechar uma instância corta o chat correspondente bem antes do TTL de 30
minutos do chat em si. O cache local do painel (`chatCache.ts`) segue
isolado por conta e documento, não por instância, porque o próprio gate deste
milestone trata "mesmo documento em duas máquinas" como duas app sessions
válidas, não como um requisito de cache separado — isolar por instância
quebraria a restauração de conversa do M4.5. Já o cache de prompt remoto do
Gemini (`geminiContextCache.ts`, M4.5) passou a incluir `appSessionId` na
chave: é estado de execução, não de restauração de conversa, então duas app
sessions abertas no mesmo documento não reaproveitam mais o mesmo cache
remoto entre si (cada uma paga o custo do próprio prefixo, sem vazar nada
entre instâncias). `WING_CHAT_MAX_SESSIONS_PER_ACCOUNT` foi removido sem
substituto: nenhuma rota limita mais a quantidade de sessões de chat
simultâneas por conta, só o saldo de créditos (M4.4) limita o uso. A suíte
encerrou com 122 testes aprovados (mais o teste de banco opt-in) e o build
do add-in passou.

Gate de saída: documentos abertos simultaneamente não compartilham estado de
chat ou cache por engano, fechar o Word encerra ou deixa expirar apenas sua app
session e qualquer quantidade de instâncias autorizadas continua limitada pelo
saldo de créditos, não por assentos ou dispositivos.

## M4.7 - Ciclo de vida e cobrança do cache

Entregáveis:

- [x] limitar cada app session a uma hora de duração absoluta, sem permitir que
  heartbeats renovem esse prazo indefinidamente;
- [x] renovar a app session automaticamente quando o Word permanecer aberto,
  preservando a conversa local vinculada à conta e ao `wing_doc_id`, inclusive
  com retry automático de uma mensagem em voo durante a renovação;
- [x] encerrar ou invalidar os caches remotos associados à sessão expirada;
- [x] registrar separadamente `input_tokens`, `cached_input_tokens` e
  `cache_write_tokens` informados por GPT, Gemini e Claude;
- [x] debitar créditos somente em transações de IA, sem cobrar por sessão aberta,
  documento aberto ou tempo ocioso;
- [x] cobrar escrita de cache como entrada normal e aplicar desconto apenas sobre
  tokens que o provedor confirmar como cache hit;
- [x] definir limite técnico de tamanho por documento/cache e telemetria de
  créditos normais, cobrados e economizados;
- [x] reconciliar a cobrança estimada com o consumo real retornado pelo provedor.

Hipótese comercial inicial: cobrar 50% da tarifa de entrada sobre tokens
efetivamente recuperados do cache, manter saída e escrita de cache na tarifa
normal e oferecer gratuitamente o armazenamento necessário durante a app
session de até uma hora. O percentual deve permanecer configurável até existir
telemetria suficiente para validar custo e margem por provedor.

Gate de saída: nenhuma app session ou cache remoto sobrevive indefinidamente;
uma instância aberta por mais de uma hora é renovada sem perder a conversa; cache
miss nunca recebe desconto; cache hit comprovado reduz os créditos cobrados; e a
soma dos componentes de uso explica integralmente o débito da carteira.

## M4.8 - DDD e arquitetura hexagonal

Objetivo: reorganizar incrementalmente o backend comercial para que regras de
negócio não dependam de Oak, Supabase, Stripe ou SDKs de IA. Este milestone não
é uma reescrita geral e não deve alterar contratos HTTP nem comportamento
observável do produto.

Entregáveis:

- [x] mapear os bounded contexts iniciais: Identidade e Entitlements, Carteira
  e Billing, App Sessions, Chat e Cache;
- [x] definir entidades, value objects, invariantes e eventos de domínio apenas
  onde houver regra de negócio real, evitando modelos anêmicos e abstrações sem uso;
- [x] extrair casos de uso para a camada de aplicação, com portas de entrada
  explícitas e DTOs independentes do transporte HTTP;
- [x] definir portas de saída para persistência, pagamentos, provedores de IA,
  cache, telemetria, relógio e geração de identificadores;
- [x] transformar Oak, Supabase, Stripe, GPT, Gemini e Claude em adaptadores,
  mantendo configuração e detalhes de SDK fora do domínio;
- [x] tornar as rotas finas: autenticar, validar DTO, executar um caso de uso e
  converter seu resultado em resposta HTTP;
- [x] migrar um contexto por vez, preservando os testes de contrato existentes
  e evitando uma troca estrutural de todo o backend em um único PR;
- [x] adicionar testes unitários das regras de domínio sem rede, banco ou ENV e
  testes de contrato para os adaptadores críticos;
- [x] documentar dependências permitidas entre camadas e contextos, incluindo
  uma regra automatizada que impeça imports de infraestrutura no domínio;
- [x] remover serviços legados somente depois que seus casos de uso e contratos
  tiverem sido substituídos e validados.

Ordem sugerida de migração: App Sessions, Carteira e Billing, Cache, Chat e, por
último, Identidade. App Sessions oferece o primeiro corte com menor risco;
Carteira e Billing validam as fronteiras onde consistência e idempotência são
mais importantes; Chat fica para depois porque coordena os demais contextos.

Gate de saída: regras de crédito, expiração de sessão e cobrança de cache podem
ser executadas em testes sem Oak, Supabase, Stripe ou APIs externas; trocar um
provedor exige implementar um adaptador, não alterar o domínio; as rotas públicas
continuam compatíveis; e a suíte completa permanece verde durante toda a migração.

## M5 - Empacotamento e ambiente de produção

Entregáveis:

- [x] preparar geração parametrizada do manifesto de produção e falhar o build
  quando `PROD_APP_DOMAIN` não estiver definido;
- [ ] definir no manifesto final URLs, ícones, suporte e SSO definitivos;
- [x] configurar o build de produção sem `devServer`, HMR e referências de
  desenvolvimento no manifesto gerado;
- [ ] inspecionar o artefato implantado e comprovar ausência de `localhost` e HMR;
- [ ] substituir os domínios temporários pelo domínio oficial no manifesto,
  em `BACKEND_URL` e em `CORS_ALLOWED_ORIGINS`;
- [x] implementar e testar em modo de produção a rejeição de `localhost`, túnel,
  wildcard e origem `null` no CORS;
- [ ] validar contra o endpoint implantado que `localhost`, o túnel
  `supercontext-ui.atdigitalbank.com.br`, wildcard e origem `null` não recebem
  autorização CORS;
- [x] separar e documentar configurações de dev, staging e produção;
- [ ] validar certificados, secrets, health check e observabilidade;
- [ ] executar smoke test no Word Windows, Mac e Web.

Gate de saída: o pacote instalado em uma máquina limpa abre o Wing, autentica e conclui uma ação sem depender de infraestrutura local.

## M5.1 - Site comercial e cadastro

Objetivo: publicar uma presença comercial mínima para explicar a proposta do
Wing e converter um visitante em cliente, do cadastro à contratação de um plano,
reaproveitando a identidade, o Magic Link e o gateway Stripe existentes.

Entregáveis:

- [ ] criar uma landing page curta, responsiva e acessível no domínio oficial;
- [x] apresentar problema, proposta de valor, principais casos de uso e CTA de cadastro;
- [x] criar o fluxo `Cadastrar` com e-mail, código de acesso e confirmação da conta;
- [x] reutilizar os endpoints de Magic Link e a criação de conta existentes,
  sem introduzir uma segunda identidade;
- [x] aplicar rate limit, mensagens anti-enumeração e tratamento claro de erros;
- [ ] definir e apresentar planos contratáveis com preço, créditos, limites e
  diferenças objetivas entre Free, Pro e futuras ofertas para escritórios;
- [ ] permitir a contratação do plano Pro no próprio site, conectando o CTA ao
  checkout Stripe após cadastro ou autenticação;
- [ ] tratar retorno, cancelamento e falha do checkout e confirmar no site o
  plano efetivamente ativado;
- [ ] disponibilizar Termos de Uso, Política de Privacidade, contato e suporte;
- [ ] definir o destino após o cadastro conforme a intenção do usuário:
  instalação do add-in, acesso ao plano Free ou início do checkout;
- [ ] registrar telemetria mínima do funil: visita, início do cadastro,
  cadastro concluído e checkout iniciado;
- [ ] validar o fluxo em desktop e mobile, incluindo expiração e reenvio do código.

Fora deste milestone: blog, CMS, área editorial, painel administrativo e site
institucional extenso.

Gate de saída: uma pessoa sem conta acessa o domínio oficial, entende o produto,
compara os planos, conclui o cadastro por e-mail, contrata o plano escolhido no
próprio site e recebe um próximo passo utilizável sem intervenção manual.

## M6 - Quality gate e piloto pago

Entregáveis:

- [ ] excluir artefatos gerados do lint e zerar erros no código mantido;
- [x] criar CI para check, testes, build, lint e validação do manifesto;
- [ ] corrigir os erros atuais do lint e tornar todos os checks do CI verdes e
  obrigatórios para merge;
- [x] cobrir auth, billing, quota, chat e telemetria com testes de integração;
- [x] criar roteiro manual para interações reais com o Word;
- [ ] executar revisão de segurança e privacidade;
- [ ] documentar rollback, suporte e operação do piloto;
- [ ] liberar primeiro para um grupo pequeno de clientes pagantes.

Gate de saída: todos os checks são bloqueantes no CI e o piloto possui responsável, métricas, suporte e rollback definidos.

## M7 - Enterprise

Entregáveis:

- [ ] criar organizações com múltiplas contas, workspaces e membros;
- [ ] implementar papéis `owner`, `admin` e `member` com autorização no backend;
- [ ] criar console central para administrar membros, planos, limites, modelos e políticas;
- [ ] permitir distribuição e acompanhamento de créditos por organização, workspace e conta;
- [ ] registrar trilha imutável de alterações administrativas, com autor, data, valor anterior e novo valor;
- [ ] oferecer busca, filtros e exportação do histórico de alterações;
- [ ] garantir isolamento de dados, billing e telemetria entre organizações;
- [ ] preparar SSO corporativo, provisionamento e revogação centralizada.

O controle de alterações registra mudanças de configuração, acesso, plano,
limites e políticas. Ele nunca registra texto de documentos, prompts ou
respostas. Uma pessoa autorizada pode administrar múltiplas contas e
organizações sem compartilhar sessões, documentos ou carteiras indevidamente.

Gate de saída: testes de isolamento comprovam que membros de uma organização
não acessam dados de outra, toda alteração administrativa relevante possui
auditoria consultável e a remoção de um membro revoga seu acesso sem afetar as
demais contas.

## 3. Ordem recomendada

1. Executar M1 antes de qualquer integração de pagamento.
2. Construir M2 sobre a sessão Wing, sem aceitar e-mail ou plano enviados pelo frontend.
3. Fechar M3 e M4 em paralelo depois que a identidade estiver estável.
4. Fechar M4.5 e M4.6 antes de congelar os contratos do pacote comercial.
5. Consolidar M5 somente com contratos de API definidos.
6. Usar M6 como gate de lançamento, não como backlog posterior.
7. Iniciar M7 somente depois do piloto validar operação, custos e suporte.

## 4. Itens deliberadamente adiados

- recuperação semântica local no Fale com o documento;
- Visual Law e análise jurídica;
- AppSource público;
- planos Team e Enterprise, até o início do M7;
- múltiplos provedores configuráveis pelo usuário.

A recuperação local do chat é uma evolução de privacidade e custo, mas o RFC 014 permite o envio inicial do documento completo ao backend. Ela não bloqueia o primeiro piloto desde que os limites e consentimentos estejam claros.
