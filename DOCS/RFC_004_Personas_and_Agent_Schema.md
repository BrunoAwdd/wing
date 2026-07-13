# RFC 004 — Personas & Agent Schema (Especificação Oficial do Wing Agents Hub)
**Status:** Superseded by RFC 016

**Autor:** Bruno Oliveira  
**Componentes:** Wing Agents Hub, Gemini Backend, Maestro, Client Engine  
**Data:** 29/11/2025  
**Audiência:** Engenharia, IA, Linguística Computacional, Arquitetura de Sistemas  

---

# 1. Propósito

Este RFC define, de forma completa, a arquitetura, as regras e os requisitos formais para a implementação das **Personas (Agentes Cognitivos)** do Wing e o **Agent Schema**, que padroniza toda resposta do backend.

O Wing depende de agentes altamente especializados, consistentes e previsíveis para garantir:

- qualidade  
- estilo padronizado  
- segurança jurídica  
- isolamento de comportamentos  
- explicabilidade  
- auditabilidade  

---

# 2. Metas e Não-Metas

## 2.1 Metas

O sistema de agentes **DEVE**:

1. Padronizar como cada persona pensa, escreve e age.  
2. Restringir o comportamento do modelo generativo via SystemInstruction.  
3. Produzir respostas **100% JSON**, sem ambiguidade.  
4. Garantir isolamento entre personagens — cada uma com tom próprio.  
5. Oferecer schemas formais para validação do Client Engine.  
6. Suportar execução atômica (um agente → uma tarefa).  
7. Evitar saída textual fora do formato descrito.  

## 2.2 Não-Metas

O sistema **NÃO DEVE**:

1. Gerar conteúdo final em Word diretamente.  
2. Decidir workflow — responsabilidade do Maestro.  
3. Acessar diretamente o documento do usuário.  
4. Manter estado interno persistente entre execuções.  

---

# 3. Arquitetura Geral do Wing Agents Hub

```text
    Client Engine
        │ payload
        ▼
┌─────────────────────┐
│     Agents Hub       │
│  (Factory + Registry)│
└───────┬─────────────┘
        │ instancia
        ▼
┌─────────────────────┐
│  Gemini 1.5 Flash    │
│  (inference only)    │
└─────────────────────┘
```

Funções principais:

- Registro de Personas  
- Factory para criação de instâncias  
- Validação de schemas  
- Execução atômica por chamada  

---

# 4. Estrutura Formal do Agent Manifest

Cada agente é definido por um manifesto:

```ts
interface AgentManifest {
  id: string
  system: string
  temperature: number
  allowedTools: string[]
  schema: object
}
```

### 4.1 Campos obrigatórios

| Campo          | Tipo       | Obrigatório | Descrição |
|----------------|------------|-------------|-----------|
| id             | string     | Sim         | Nome da persona |
| system         | string     | Sim         | Instruções rígidas de comportamento |
| temperature    | number     | Sim         | Controle de criatividade/rigidez |
| allowedTools   | string[]   | Sim         | Ferramentas permitidas (geralmente vazio) |
| schema         | object     | Sim         | Estrutura JSON obrigatória para saída |

---

# 5. Personas Oficiais do Wing

## 5.1 Legal (Jurídica — Linguagem Culta)

**Função:**  
Produzir textos jurídicos formais, cultos, coerentes e tecnicamente precisos.

**SystemInstruction:**  
- jamais utilizar linguagem coloquial  
- privilegiar clareza, formalidade e precisão técnica  
- seguir estilo jurídico brasileiro (CPC / civil)  
- evitar redundâncias  
- organizar argumentos de forma lógica  

**Temperature:** 0.1

---

## 5.2 Audit (Auditoria Contábil/Jurídica)

**Função:**  
Detectar inconsistências, incoerências, omissões e fragilidades.

**SystemInstruction:**  
- agir como perito  
- identificar falhas conceituais  
- apontar riscos jurídicos e contábeis  
- nunca reescrever — apenas analisar  

**Temperature:** 0.0

---

## 5.3 Writer (Reescrita Elegante)

**Função:**  
Transformar um texto cru em versão clara, elegante e sofisticada.

**SystemInstruction:**  
- linguagem cadenciada  
- preservar sentido original  
- elevar fluidez  
- não rebuscar excessivamente  

**Temperature:** 0.3

---

## 5.4 Critic (Crítico Técnico)

**Função:**  
Avaliar qualidade do texto produzido, sugerir melhorias, identificar falhas estruturais.

**SystemInstruction:**  
- tom direto  
- identificar fragilidades  
- sugerir melhorias  
- não reescrever totalmente  

**Temperature:** 0.2

---

## 5.5 Summary (Síntese Inteligente)

**Função:**  
Gerar resumos objetivos, preservando conceitos e intenções.

**SystemInstruction:**  
- remover redundâncias  
- manter precisão conceitual  
- nunca inventar fatos  
- foco em clareza  

**Temperature:** 0.2

---

# 6. Esquema Formal da Resposta

Formato obrigatório:

```json
{
  "thought_process": "string",
  "action_payload": {}
}
```

---

# 7. Endpoint de Execução

POST /api/agent/execute

---

# 8. Segurança

- JSON only  
- isolamento entre agentes  
- sem internet  
- sem concatenação de instruções  

---

# 9. Roadmap

- V1: personas fixas  
- V2: agentes dinâmicos  
- V3: aprendizado adaptativo  

---

# 10. Conclusão

O Agents Hub padroniza e disciplina a cognição do Wing, garantindo previsibilidade, profissionalismo e comportamento controlado em cada execução.
