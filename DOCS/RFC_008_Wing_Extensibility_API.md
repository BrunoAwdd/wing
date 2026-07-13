# RFC 008 — Wing Extensibility API (Arquitetura de Extensão do Wing)
**Status:** Superseded by RFC 016

**Autor:** Bruno Oliveira  
**Componentes:** Client Engine, Agents Hub, (Futuro) Wing Local Service, Plugins  
**Data:** 29/11/2025  
**Audiência:** Engenharia, Arquitetura, Desenvolvedores de Terceiros, Produto Enterprise  

---

## 1. Propósito

Este RFC define a **Wing Extensibility API** — o conjunto de contratos que permitirá, hoje e no futuro, que o Wing seja estendido de forma controlada por:

- novas personas (agentes especializados)  
- novas ferramentas (ex.: analisadores, checklists, validadores)  
- novos painéis/visões na UI  
- integrações opcionais com serviços locais (ex.: Wing Local Service, DMS, sistemas internos)

O objetivo é garantir que o Wing seja **modular, extensível e enterprise-ready**, sem comprometer:

- segurança  
- previsibilidade  
- UX  
- política de privacidade  

---

## 2. Metas e Não-Metas

### 2.1 Metas

A Extensibility API **DEVE**:

1. Fornecer um modelo formal de **extensão por configuração**, não por “hack” no core.  
2. Permitir que novas personas sejam adicionadas sem alterar o código central.  
3. Permitir registro de **Custom Tools** (funções utilitárias invocáveis pelos agentes).  
4. Permitir painéis adicionais no Client Engine (ex.: “Painel de Compliance”, “Painel de Checklists”).  
5. Garantir que nenhuma extensão quebre o contrato de segurança do Wing.  

### 2.2 Não-Metas

A Extensibility API **NÃO DEVE**:

- expor chaves ou segredos  
- permitir que extensões acessem o documento diretamente sem passar pela camada de segurança  
- permitir alteração do comportamento nuclear do Maestro  
- servir como sistema de plugins genéricos de Word (o foco é Wing, não um framework genérico)  

---

## 3. Tipos de Extensões

### 3.1 Custom Agents (Personas Adicionais)

Extensões que adicionam novas personas com:

- `id` próprio  
- `system` personalizado  
- `schema` específico  

Exemplos:

- `"TaxConsultant"`  
- `"MarketingCopy"`  
- `"ESGReviewer"`  

### 3.2 Custom Tools (Ferramentas Invocáveis)

Funções auxiliares que podem ser utilizadas por agentes para:

- formatar tabelas  
- gerar sumários numéricos  
- validar dados estruturados  
- puxar dados de um serviço local (ex.: base interna)  

### 3.3 UI Panels (Painéis Adicionais)

Blocos de interface no painel do Wing, com:

- visualização de resultados específicos  
- dashboards de auditoria  
- checklists  
- indicadores de risco  

### 3.4 Local Service Plugins (Futuro V2)

Extensões que rodam do lado do **Wing Local Service**:

- regras de retenção  
- criptografia customizada  
- integrações com DMS interno  
- logging avançado  

---

## 4. Modelo de Registro de Extensões

### 4.1 Arquivo de Manifesto

Extensões são declaradas via um manifesto (ex.: JSON ou TS) no backend:

```ts
interface WingExtensionManifest {
  id: string
  type: "agent" | "tool" | "ui-panel" | "local-service-plugin"
  config: any
}
```

### 4.2 Registro de Custom Agent

```ts
interface CustomAgentConfig {
  manifest: AgentManifest     // conforme RFC 004
  visibleName: string         // para UI
  category?: string           // ex.: "Tributário", "Marketing"
}
```

O backend carrega todos os agentes customizados no bootstrap.

### 4.3 Registro de Custom Tool

```ts
interface CustomToolConfig {
  name: string
  description: string
  inputSchema: object
  outputSchema: object
  handler: (input: any, context: ToolContext) => Promise<any>
}
```

- O `handler` roda no backend ou no Local Service.  
- Agentes podem chamar a ferramenta via `allowedTools`.

---

## 5. API de Agentes Customizados

### 5.1 Adição de um novo AgentManifest

1. Desenvolvedor cria um `AgentManifest` conforme RFC 004.  
2. Registra no `AgentsRegistry`.  
3. A UI lê a lista de agentes e exibe os novos em menus avançados.

### 5.2 Restrições

- Agente customizado **DEVE** seguir a saída padrão `{ thought_process, action_payload }`.  
- Agente customizado **NÃO PODE** contornar o schema.  
- Agente customizado **DEVE** respeitar as políticas de segurança global (ex.: sem dados sensíveis em thought_process).

---

## 6. API de Tools Customizadas

### 6.1 Chamadas de Tool a partir de um Agente

Os agentes podem receber no `system` algo como:

> “Você pode chamar as seguintes ferramentas: `CalcTributo`, `CheckTabela`, `LocalSearch`.”

O Agents Hub, ao receber o pedido, executa o `handler` da tool e injeta o resultado na resposta.

### 6.2 Controle de Ferramentas Permitidas

Cada `AgentManifest` define:

```ts
allowedTools: ["CalcTributo", "LocalSearch"]
```

O Agents Hub **DEVE**:

- bloquear qualquer tentativa de tool fora dessa lista  
- logar o uso de cada tool para auditoria  

---

## 7. UI Panels — Extensões na Interface

### 7.1 Contrato

```ts
interface UIPanelExtension {
  id: string
  title: string
  mount: (container: HTMLElement, api: WingUIApi) => void
}
```

- `mount` é chamado quando o painel Wing é inicializado.  
- Extensão pode renderizar conteúdo (React, Vanilla, etc.) dentro de um container isolado.  

### 7.2 WingUIApi

```ts
interface WingUIApi {
  getCurrentPlan(): Plan | null
  getExecutionLogs(): ExecutionLog[]
  subscribe(event: "planUpdated" | "executionStep", handler: Function): Unsubscribe
}
```

Extensões de UI **NÃO** acessam diretamente o documento Word — apenas via API existente.

---

## 8. Wing Local Service Plugins (V2)

Extensões do lado do serviço local podem:

- definir política de criptografia  
- definir política de retenção  
- definir formato de exportação de logs  
- integrar com sistemas internos  

Contratos detalhados serão especificados no futuro **RFC 011 – Wing Local Service**.

---

## 9. Segurança e Sandbox de Extensões

A Extensibility API **DEVE** garantir:

1. Nenhuma extensão acessa o documento sem passar pelas mesmas camadas de segurança do core.  
2. Extensões de UI não podem executar JS arbitrário além de seu próprio escopo.  
3. Ferramentas não podem chamar rede externa sem estar explicitamente autorizadas em configuração.  
4. Logs de uso de extensões são mantidos (localmente ou via Local Service) para auditoria.

---

## 10. Versionamento e Compatibilidade

- Cada extensão declara um campo opcional `compatibleWith`:

```ts
compatibleWith: {
  minWingVersion: "1.0.0",
  maxWingVersion?: "1.x"
}
```

- O Wing **DEVE** desabilitar extensões marcadas como incompatíveis com a versão atual.  

---

## 11. Roadmap

### V1 (escopo deste RFC)
- Registro de agentes customizados  
- Registro de tools customizadas simples  
- UI panels básicos  

### V2
- Plugins para Wing Local Service  
- Políticas avançadas de autorização por extensão  
- Interface gráfica para ativar/desativar extensões por perfil de usuário  

### V3
- Marketplace privado de extensões  
- Templates de extensões para verticais (jurídico, contábil, médico, etc.)  

---

## 12. Conclusão

A Wing Extensibility API é o pilar que transforma o Wing de um produto fechado em uma **plataforma**.

Ela permite:

- que grandes escritórios e empresas moldem o Wing aos seus fluxos  
- que novas personas e ferramentas surjam sem tocar no core  
- que integradores criem módulos especializados (ex.: tributário, societário, M&A, ESG)

Tudo isso mantendo o mesmo padrão de:  
**segurança, previsibilidade, privacidade e UX** que o Wing 1.0 estabelece como baseline.
