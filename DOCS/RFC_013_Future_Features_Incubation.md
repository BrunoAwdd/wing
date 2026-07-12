# RFC 013 - Incubação de Features Futuras

**Status:** Aprovado para incubação
**Autor:** Bruno Oliveira
**Data:** 2026-07-11
**Audiência:** Produto e Engenharia

---

## 1. Decisão

Visual Law e análise jurídica estruturada são features futuras do Wing. Elas permanecem no repositório, mas ficam desligadas no produto comercial até atingirem maturidade suficiente.

Desligar significa:

- não exibir entradas na interface;
- não registrar os endpoints no backend;
- não executar análises ou alterações no documento;
- não apagar código, temas, prompts ou documentação técnica;
- permitir reativação futura por configuração e novo ciclo de validação.

## 2. Features incubadas

### 2.1 Visual Law e design documental

Inclui:

- sincronização e modificação ampla de estilos do Word;
- temas visuais;
- identificação automática de títulos;
- criação e transformação de tabelas;
- geração de gráficos;
- painéis visuais inseridos no documento.

O fluxo demonstrou viabilidade técnica, mas ainda apresenta variabilidade na identificação estrutural e no resultado visual. Uma ação ampla de formatação precisa ser previsível em documentos reais antes de ser vendida.

**Feature flag:** `WING_FEATURE_DOCUMENT_DESIGN=false`

### 2.2 Análise jurídica estruturada

Inclui:

- extração de partes, cláusulas, prazos e obrigações;
- classificação de risco;
- destaque automático de cláusulas;
- gráfico de distribuição de risco;
- inserção de resumo jurídico no documento.

O fluxo ainda precisa de avaliação de qualidade, rastreabilidade, linguagem de segurança e critérios claros para falso positivo e falso negativo.

**Feature flag:** `WING_FEATURE_LEGAL_ANALYSIS=false`

## 3. O que não pertence a este RFC

Este RFC não desliga nem reclassifica:

- correção e revisão textual;
- reescrita;
- tradução;
- resumo;
- memória local;
- sincronização de memória;
- conversa com o documento;
- histórico e controle de alterações.

Essas capacidades compõem o produto atual e são tratadas no RFC 014.

## 4. Regras de incubação

1. O código continua compilando e recebendo correções necessárias para não quebrar o restante do produto.
2. Não haverá evolução de escopo sem hipótese, responsável e critério de sucesso.
3. Nenhuma feature incubada pode aparecer acidentalmente em produção.
4. Rotas desligadas devem responder `404`, não apenas esconder botões.
5. Dados ou migrations compartilhados não podem ser removidos durante a incubação.
6. O custo de manutenção será revisto a cada 60 dias.

## 5. Critérios para reativação

### Visual Law

- pelo menos 20 documentos canônicos cobrindo contratos, petições e pareceres;
- identificação correta da hierarquia em pelo menos 95% dos títulos esperados;
- aplicação idempotente dos estilos;
- desfazer ou recuperação testados;
- nenhuma corrupção documental nos testes suportados;
- validação visual por usuários jurídicos;
- proposta comercial específica e distinta do núcleo atual.

### Análise jurídica

- golden set jurídico revisado por profissional habilitado;
- métricas separadas para extração e classificação de risco;
- evidência e trecho-fonte para cada conclusão;
- avisos de uso e limites aprovados;
- política de privacidade compatível com documentos jurídicos;
- liberação inicial apenas por conta ou tenant.

## 6. Arquitetura de desligamento

Frontend:

```text
WING_FEATURE_DOCUMENT_DESIGN=false
WING_FEATURE_LEGAL_ANALYSIS=false
```

Backend:

```text
WING_FEATURE_DOCUMENT_DESIGN=false
WING_FEATURE_LEGAL_ANALYSIS=false
```

Os defaults são `false`. A reativação exige configuração explícita nos dois lados e um novo deploy.

## 7. Critérios de aceite

- botões de Visual Law e análise jurídica não aparecem;
- navegação direta para essas telas não é possível;
- `/api/v1/design/*` não é registrado;
- `/api/v1/legal/*` não é registrado;
- memória, revisão, tradução e conversa continuam operando;
- os arquivos das features futuras permanecem no repositório;
- testes impedem ativação acidental.

## 8. Consequência

O Wing preserva o investimento já feito, mas o lançamento deixa de depender de duas experiências que ainda não estão prontas para representar a qualidade do produto.
