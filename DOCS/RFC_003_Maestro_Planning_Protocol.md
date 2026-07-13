# RFC 003 — Maestro Planning Protocol (Protocolo de Orquestração Cognitiva)
**Status:** Superseded by RFC 016

**Autor:** Bruno Oliveira  
**Componentes:** Maestro Planner, Agents Hub, Client Engine  
**Data:** 29/11/2025  
**Audiência:** Engenharia, Arquitetura, IA, Linguística Computacional  

---

# 1. Propósito

O **Maestro Planning Protocol** define como o Wing transforma instruções complexas do usuário em **planos determinísticos**, compostos por passos lineares, auditáveis e previsíveis, que serão executados pelo Client Engine.

O Maestro é responsável por:

- decompor tarefas complexas
- selecionar agentes apropriados
- estruturar um fluxo linear de execução
- garantir previsibilidade e ausência de loops
- produzir um plano 100% legível e verificável

Este RFC descreve essa lógica de forma completa.

---

# 2. Metas e Não-Metas

## 2.1 Metas

O Maestro **DEVE**:

1. Gerar planos **determinísticos** (mesmas entradas → mesmo plano).  
2. Produzir apenas **steps lineares** e finitos.  
3. Respeitar schemas formais de steps.  
4. Indicar explicitamente qual agente executará cada parte.  
5. Utilizar contexto local do Rust apenas como entrada factual.  
6. Permitir que o usuário revise e edite o plano antes da execução.  
7. Minimizar ambiguidade e redundância.

## 2.2 Não-Metas

O Maestro **NÃO DEVE**:

1. Executar tarefas — execução pertence ao Client Engine.  
2. Manipular diretamente o documento Word.  
3. Realizar inferência profunda — isso é trabalho dos agentes.  
4. Criar loops, branches ou lógica condicional complexa.  
5. Alterar steps durante execução — o plano é imutável após aprovado.

---

# 3. Arquitetura Geral

```text
   Usuário
      │ instrução
      ▼
┌────────────────────┐
│     Maestro         │
│  (Gerador de Plano) │
└───────┬────────────┘
        │ JSON Steps
        ▼
┌────────────────────┐
│   Client Engine     │
│ Executa Step-By-Step│
└───────┬────────────┘
        │ agente
        ▼
┌────────────────────┐
│   Agents Hub       │
└────────────────────┘
```

---

# 4. Especificação do Formato do Plano

O plano **DEVE** ser um array JSON de steps.

## 4.1 Estrutura de Step

```json
{
  "stepId": 0,
  "agentId": "Summary",
  "topic": "Resumo inicial do texto",
  "type": "analysis",
  "description": "Gerar um resumo objetivo do conteúdo relevante"
}
```

### 4.2 Campos obrigatórios

| Campo        | Tipo     | Obrigatório | Descrição |
|--------------|----------|-------------|-----------|
| stepId       | number   | Sim         | Índice sequencial do step |
| agentId      | string   | Sim         | Persona responsável |
| topic        | string   | Sim         | Assunto ou objetivo local |
| type         | string   | Sim         | `analysis`, `rewrite`, `audit`, `synthesis`, etc. |
| description  | string   | Sim         | Detalhe humano-legível da ação |

### 4.3 Regras formais do plano

O plano:

- **DEVE** ser um array simples  
- **DEVE** ser ordenado por `stepId`  
- **NÃO DEVE** conter loops  
- **NÃO DEVE** conter referências recursivas  
- **PODE** referenciar resultados anteriores através de `previousStepOutput` (via Client Engine)  
- **DEVE** ser 100% estático após aprovação do usuário  

---

# 5. Processo de Planejamento

## 5.1 Input recebido pelo Maestro

```json
{
  "instruction": "reescreva esta cláusula com linguagem jurídica culta",
  "contextChunks": [...],
  "availableAgents": ["Summary", "Legal", "Critic", "Writer", "Audit"]
}
```

## 5.2 Etapas internas (não expostas ao usuário)

1. **Interpretação da intenção**  
2. **Identificação do(s) agente(s) necessários**  
3. **Sequenciamento lógico**  
4. **Geração dos steps**  
5. **Validação do schema**  
6. **Retorno do plano**

## 5.3 Exemplo de plano

```json
[
  {
    "stepId": 0,
    "agentId": "Summary",
    "topic": "Resumo inicial",
    "type": "analysis",
    "description": "Gerar síntese do contexto para alinhar entendimento"
  },
  {
    "stepId": 1,
    "agentId": "Legal",
    "topic": "Reescrita jurídica",
    "type": "rewrite",
    "description": "Produzir versão culta e jurídica da cláusula"
  },
  {
    "stepId": 2,
    "agentId": "Critic",
    "topic": "Avaliação da qualidade",
    "type": "analysis",
    "description": "Avaliar clareza, solidez e técnica do texto gerado"
  }
]
```

---

# 6. Endpoint do Maestro

**POST /api/maestro/plan**

### 6.1 Request

```json
{
  "instruction": "reescreva a cláusula",
  "context": ["texto 1", "texto 2"],
  "availableAgents": ["Summary", "Legal", "Writer", "Critic"]
}
```

### 6.2 Response

```json
{
  "plan": [...],
  "justification": "Para atingir a qualidade jurídica solicitada...",
  "estimatedSteps": 3
}
```

---

# 7. Validação e Erros

## 7.1 O Maestro DEVE validar:

- estrutura JSON  
- tipo e ordem dos campos  
- agente existente  
- tipo permitido  
- ausência de loops  
- ausência de branches  

## 7.2 Erros típicos

- **AGENT_NOT_FOUND**  
- **INVALID_SCHEMA**  
- **LOOP_DETECTED**  
- **EMPTY_PLAN**  
- **AMBIGUOUS_INSTRUCTION**

Cada erro deve retornar JSON claro.

---

# 8. Segurança

O Maestro NÃO acessa o documento diretamente.  
Toda entrada é mediada pelo Client Engine.

O Maestro:

- não armazena dados  
- não gera conteúdo final  
- não tem permissão de execução  
- apenas planeja  

---

# 9. Roadmap

### V1 (este RFC)
- Steps lineares  
- Agentes fixos  
- Sem branching  

### V2
- Subtasks complexas  
- Classificação automática da intenção  

### V3
- Planos híbridos (condicionais simples)  
- Adaptação ao perfil do usuário  

---

# 10. Conclusão

O Maestro é o cérebro estrutural do Wing — ele transforma instruções vagas em planos claros, previsíveis e auditáveis.  
Sem o Maestro, o Wing seria um copiloto caótico; com ele, se torna uma ferramenta profissional, estável e explicável.
