# RFC 007 — Wing Client Engine: UI/UX Blueprint (Especificação Oficial)
**Status:** Partially superseded by RFC 014 and RFC 016

**Autor:** Bruno Oliveira  
**Componentes:** Client Engine (Frontend), React, Office.js, Wing Memory Engine, Maestro  
**Data:** 29/11/2025  
**Audiência:** Engenharia Frontend, UX, Arquitetura, Produto**

---

# 1. Propósito

Este RFC define a especificação **completa** do **Wing Client Engine**, responsável por:

- gerenciar a interface do usuário  
- controlar a execução passo a passo dos planos  
- integrar o Word (Office.js) ao Wing Memory Engine (WASM)  
- exibir logs, status e previsibilidade  
- servir como painel operacional do Wing  

O objetivo é garantir uma experiência **profissional, fluida, transparente e confiável**.

---

# 2. Metas e Não-Metas

## 2.1 Metas

O Client Engine **DEVE**:

1. Prover uma UI clara e estável para planejamento e execução.  
2. Exibir logs e estados em tempo real.  
3. Integrar o documento Word via Office.js sem bloquear a UI.  
4. Permitir revisão e edição do plano antes de executar.  
5. Executar workflows de forma totalmente determinística.  
6. Expor mensagens de erro compreensíveis.  
7. Mostrar status do índice (WASM).  
8. Reagir dinamicamente a mudanças no documento.  

## 2.2 Não-Metas

O Client Engine **NÃO DEVE**:

- tomar decisões cognitivas (isso é do Maestro)  
- gerar texto (isso é dos Agentes)  
- persistir dados sozinho (usa IndexedDB ou Local Service)  

---

# 3. Arquitetura Geral

```text
┌────────────────────────────┐
│        Painel Wing          │
│   (UI/UX — React/TS)       │
└──────────────┬─────────────┘
               │ eventos/UI
               ▼
┌────────────────────────────┐
│       Client Engine         │
│ state machine / workflow   │
└──────────────┬─────────────┘
               │ chamadas
               ▼
┌────────────────────────────┐
│       Wing Memory          │
│     Engine (WASM)          │
└──────────────┬─────────────┘
               │ contexto
               ▼
┌────────────────────────────┐
│        Agents Hub          │
│   (Node.js + Gemini)       │
└────────────────────────────┘
```

---

# 4. State Machine do Cliente

### Estados principais:

```text
Idle → Planning → PlanReady → Executing → Completed
                    ↑
                   Edit
```

### Descrição

| Estado        | Descrição |
|---------------|-----------|
| Idle          | Painel carregado, aguardando ação. |
| Planning      | Enviando instrução ao Maestro. |
| PlanReady     | Plano disponível para revisão. |
| Edit          | Usuário edita manualmente steps. |
| Executing     | Workflow em execução determinística. |
| Completed     | Execução finalizada com sucesso. |
| Error         | Qualquer falha gera mensagem controlada. |

---

# 5. UI Principal (Painel Lateral)

### Componentes Core:

1. **Input de instrução do usuário**  
2. **Botão “Gerar Plano”**  
3. **Pré-visualização do Plano (JSON visual)**  
4. **Botão “Executar Plano”**  
5. **Log de Execução (tempo real)**  
6. **Status do Índice (WASM)**  
7. **Histórico (executions)**  
8. **Indicadores visuais**  

### Exemplo de layout ASCII

```
┌──────────────────────────────┐
│           WING PANEL          │
├──────────────────────────────┤
│ Instrução: [               ]  │
│ [Gerar Plano]                 │
│------------------------------│
│ Plano:                        │
│  - Step 0 (Summary)           │
│  - Step 1 (Legal)             │
│  - Step 2 (Critic)            │
│ [Editar] [Executar]           │
│------------------------------│
│ Execução:                     │
│  • Lendo índice (WASM)…       │
│  • Chamando agente Legal…     │
│  • Inserindo no Word…         │
│------------------------------│
│ Estado do índice: Atualizado │
└──────────────────────────────┘
```

---

# 6. Document Observer (Office.js)

### 6.1 Gatilhos

```ts
Office.context.document.addHandlerAsync(
  Office.EventType.DocumentSelectionChanged,
  onDocumentChanged
)
```

### 6.2 Lógica de Delta

1. Observar trechos alterados  
2. Extrair apenas parágrafos novos  
3. Enviar ao WASM via `ingestDelta()`  
4. Atualizar status: “Indexando…” → “Indexado”  

---

# 7. Execução do Workflow (Task Loop)

### Pseudocódigo

```ts
async function executeWorkflow(plan) {
  for (step of plan) {
    log(`➡️ Step ${step.stepId}: ${step.agentId}`);

    const context = await wasm.query(step.topic, 6);
    const response = await callAgent(step.agentId, {
      userInstruction: step.description,
      context,
      previous: getPrev(step.stepId)
    });

    await applyToWord(response.action_payload);
  }

  setState("Completed");
}
```

---

# 8. UX e Responsividade

- UI nunca deve travar Word  
- todo loading é suave  
- logs em tempo real  
- erros sempre human-readable  
- permitir cancelar execução  

---

# 9. Erros

- WASM: índice vazio, modelo faltando  
- Maestro: plano inválido  
- Agent: JSON quebrado  
- Office.js: falha ao escrever  

Cada erro deve acionar estado `Error` com explicação.

---

# 10. Roadmap

### V1
- UI fixa  
- logs básicos  

### V2
- editor visual de steps  
- exportação de logs  

### V3
- temas  
- modo compacto  
- múltiplos documentos  

---

# 11. Conclusão

O Client Engine é o centro operacional do Wing.  
Sem ele, o sistema teria inteligência — mas não teria **controle**, **clareza**, **previsibilidade** ou **auditabilidade**.  
O Wing depende de uma UI sólida e inteligente para alcançar seu potencial máximo.
