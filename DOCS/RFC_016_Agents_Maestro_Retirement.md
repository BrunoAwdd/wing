# RFC 016 - Aposentadoria de Agents Hub e Maestro

**Status:** Proposto
**Autor:** Bruno Oliveira
**Data:** 2026-07-11
**Audiência:** Produto e Engenharia
**Depende de:** RFC 014

---

## 1. Decisão

O Wing aposentará Agents Hub e Maestro Planner. Eles não pertencem ao produto comercial atual nem ao roadmap de features incubadas.

A aposentadoria será uma remoção real de código, rotas, inicialização e assets relacionados. O trabalho será executado em uma etapa posterior; este RFC contém somente o plano.

## 2. Motivo

Agents e Maestro representam uma arquitetura de produto anterior:

- não possuem mais interface ativa no frontend;
- não participam de revisão, tradução, memória local ou conversa com documento;
- mantêm rotas e serviços sem consumidor comercial;
- aumentam superfície de segurança e manutenção;
- misturam plataforma de agentes com a proposta atual do Wing;
- desviam investimento do núcleo e do gateway de pagamento.

## 3. Escopo de remoção

### 3.1 Backend

Remover:

- `backend/src/services/agentsService.ts`;
- `backend/src/services/maestroService.ts`;
- imports e rotas `/api/agent/execute` e `/api/maestro/plan` em `backend/src/index.ts`;
- inicialização e APIs de extensões de agentes;
- manifests em `backend/extensions/` que existam apenas para Agents Hub.

### 3.2 Extensões e MCP

O `extensionRegistry` atual registra agentes, e o router MCP executa `agentsService`. Portanto, a aposentadoria deve incluir uma decisão explícita sobre esses componentes.

Decisão proposta:

- remover `backend/src/services/extensionRegistry.ts`;
- remover `/api/extensions/agent`;
- remover `backend/src/routes/mcpRoutes.ts` e `/api/mcp` enquanto seu único valor for expor Agents Hub;
- preservar somente extensões que comprovadamente tenham consumidor fora do sistema de agentes.

No inventário atual, não foi identificado esse consumidor independente.

### 3.3 Frontend

As páginas de Copilot, criação de agents e hooks relacionados já foram removidas anteriormente. A execução deve confirmar que não restaram:

- imports órfãos;
- tipos de navegação;
- textos ou comandos relacionados;
- caches de agents;
- chamadas para Maestro ou `/api/agent/execute`.

### 3.4 Banco de dados

A migration histórica que criou a tabela `agents` não deve ser apagada se já tiver sido aplicada em algum ambiente.

O plano correto é:

1. verificar se existem dados relevantes;
2. exportar ou arquivar os manifests necessários;
3. criar nova migration que remova tabela, policies e índices sem uso;
4. manter a migration histórica para preservar a ordem do banco.

## 4. Fora do escopo

Não remover nem alterar:

- Wing Memory Engine;
- `documentObserver`;
- persistência local do índice;
- revisão, correção e reescrita;
- tradução e resumo;
- `Fale com o documento` e suas rotas de chat;
- histórico de sugestões;
- billing, autenticação ou gateway Stripe.

## 5. RFCs afetados

Os seguintes documentos descrevem uma direção que deixa de ser ativa:

- RFC 001, nas seções de Maestro e Agents Hub;
- RFC 003, Maestro Planning Protocol;
- RFC 004, Personas and Agent Schema;
- RFC 008, Extensibility API, onde depender de agentes;
- RFC 011, Marketplace Ecosystem, onde depender de agents e plugins.

Eles não devem ser apagados. Devem receber um cabeçalho `Superseded by RFC 016` para manter o histórico arquitetural.

## 6. Sequência de execução

### R0 - Inventário

- localizar todos os imports, rotas e chamadas;
- listar arquivos exclusivos e compartilhados;
- verificar dados na tabela `agents`;
- confirmar que chat e memória não dependem de Agents/Maestro;
- registrar baseline de build e testes.

### R1 - Retirada das rotas

- remover registro das rotas de Maestro, agents, extensions e MCP;
- remover inicialização do `extensionRegistry`;
- verificar que endpoints antigos retornam `404`;
- publicar uma versão intermediária sem consumidores.

### R2 - Remoção do código

- excluir serviços e routers exclusivos;
- excluir manifests de agents;
- limpar imports, tipos e dependências;
- executar busca por símbolos aposentados;
- validar backend e frontend.

### R3 - Dados e documentação

- arquivar dados necessários;
- aplicar migration de remoção da tabela `agents`, se aprovada;
- marcar RFCs históricos como substituídos;
- atualizar diagramas, README e roadmap.

## 7. Critérios de aceite

- nenhuma rota de Agents, Maestro, extensions de agents ou MCP permanece registrada;
- nenhum serviço aposentado é importado no startup;
- busca por `agentsService`, `maestroService` e `extensionRegistry` não encontra código executável;
- chat com documento continua iniciando e respondendo;
- memória local continua inicializando, sincronizando e persistindo;
- revisão, tradução e resumo continuam funcionando;
- frontend e backend compilam;
- testes de regressão do núcleo passam;
- banco novo e banco migrado chegam ao mesmo schema suportado;
- RFCs antigos estão marcados como históricos.

## 8. Riscos

| Risco | Mitigação |
|---|---|
| MCP possuir consumidor externo desconhecido | Buscar logs e integrações antes de R1 |
| Manifests conterem propriedade intelectual útil | Exportar arquivo antes da exclusão |
| Migration destruir dados necessários | Backup e aprovação separada para R3 |
| Import compartilhado ser removido por engano | Mapa de dependências e build após cada fase |
| Chat depender indiretamente de provider compartilhado | Remover somente serviços exclusivos, preservar `aiService` |

## 9. Rollback

R1 e R2 devem ocorrer em commits separados. Se uma dependência não mapeada surgir, reverter apenas o commit da fase afetada, sem restaurar toda a arquitetura aposentada.

## 10. Entregável da próxima etapa

Uma PR exclusiva para aposentadoria, sem misturar gateway Stripe ou mudanças de produto. Ela deve conter R1 e R2; a remoção de dados de R3 exige aprovação própria.
