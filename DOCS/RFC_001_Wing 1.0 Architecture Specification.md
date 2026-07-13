# RFC 001 — Wing 1.0 Architecture Specification
**Status:** Superseded by RFC 016

**Author:** Bruno Oliveira  
**Component:** Wing Memory Engine, Maestro, Agents Hub  
**Date:** 2025-11-29  
**Audience:** Engineering, Architecture, Integrations, Product Leadership  

---

# 1. Overview

Este documento define a arquitetura oficial do **Wing 1.0**, um sistema híbrido de inteligência artificial embutido no Microsoft Word, combinando:

- **Memória e Recuperação Local (Rust + WASM)**  
- **Orquestração Cognitiva na Nuvem (Node.js + Gemini)**  
- **Execução e UI (React + Office.js)**  

Wing é o primeiro sistema a implementar **AI contextual com memória persistente local**, integrando motores de embeddings, vector store incremental, agentes especializados e um planejador determinístico.

---

# 2. Arch Goals

### 2.1 Requisitos Funcionais
- Indexação automática de documentos Word.
- Recuperação contextual com latência < 30 ms.
- Suporte a múltiplas personas/agents.
- Execução determinística via Maestro Planner.
- Interação nativa com o editor do Word.

### 2.2 Requisitos Não Funcionais
- Privacidade local (embedding on-device).
- Zero dependência de redes corporativas para contexto.
- Baixa pegada de memória (< 120 MB na runtime).
- Persistência leve via IndexedDB.
- Modularidade para substituição de modelos.

---

# 3. System Architecture (High-Level)

```
 ┌────────────────────────┐
 │      Word Editor       │
 └──────────┬─────────────┘
            │ Office.js
            ▼
 ┌────────────────────────┐
 │   Client Engine (TS)   │
 │  - Task Loop           │
 │  - Document Observer   │
 │  - UI State Machine    │
 └──────────┬─────────────┘
            │ wasm-bindgen
            ▼
 ┌────────────────────────┐
 │ Wing Memory Engine     │
 │      (Rust/WASM)       │
 │ - Embeddings Local     │
 │ - Vector Store RAM     │
 │ - Delta Indexing       │
 │ - Persistence API      │
 └───────┬────────────────┘
         │ IndexedDB
         ▼
 ┌────────────────────────┐
 │   Browser Storage      │
 │     (per docId)        │
 └────────┬───────────────┘
          │ HTTPS
          ▼
 ┌────────────────────────┐
 │   Maestro Planner      │
 │ Node.js Orchestrator   │
 └────────┬───────────────┘
          │
          ▼
 ┌────────────────────────┐
 │ Wing Agents Hub        │
 │ - Personas             │
 │ - Factory/Registry     │
 │ - Gemini 1.5 API       │
 └────────────────────────┘
```

---

# 4. Wing Memory Engine (Rust/WASM)

### 4.1 Responsibilities
- Embeddings locais usando modelo ONNX/Candle.
- Armazenamento de vetores em RAM.
- Busca por similaridade usando Cosine + SIMD.
- Atualização incremental (delta indexing).
- Serialização/deserialização do índice.

### 4.2 API Pública (via wasm-bindgen)

```
ingest(chunks: Vec<String>) -> Vec<u32>
query(query: String, top_k: u8) -> Vec<ResultItem>
delete_chunk(id: u32)
serialize() -> JsValue
load(serialized: JsValue)
```

### 4.3 Data Model

```
Entry {
  id: u32,
  text: String,
  embedding: Vec<f32>,
}
```

### 4.4 Persistência

- Snapshots serializados como `Uint8Array`.
- Armazenados em IndexedDB chaveados por `docId`.
- Politica LRU para documentos antigos.

---

# 5. Maestro Planner

### 5.1 Função

Transformar instrução do usuário em um **plano linear**, finito, previsível e auditável.

### 5.2 Input

```
{
  "userInstruction": "...",
  "availableAgents": [...],
  "contextChunks": [...]
}
```

### 5.3 Output (JSON)

```
[
  {
    "stepId": 0,
    "agentId": "Summary",
    "topic": "Análise inicial",
    "type": "analysis"
  },
  {
    "stepId": 1,
    "agentId": "Legal",
    "topic": "Reescrita jurídica",
    "type": "rewrite"
  }
]
```

### 5.4 Propriedades

- Não permite loops.
- Ordem estritamente linear.
- Cada step tem schema fixo.
- Output verificável antes da execução.

---

# 6. Wing Agents Hub (Backend)

### 6.1 Estrutura do Manifesto

```
AgentManifest {
  id: string,
  system: string,
  temperature: number,
  allowedTools: string[],
  schema: any
}
```

### 6.2 Personas

- Legal  
- Audit  
- Writer  
- Critic  
- Summary  

### 6.3 Endpoint de Execução

**POST `/api/agent/execute`**

```
{
  "agentId": "Legal",
  "userInstruction": "...",
  "context": [...],
  "previous": "..."
}
```

Retorno:

```
{
  "thought_process": "...",
  "action_payload": { ... }
}
```

---

# 7. Client Engine (TypeScript/Office.js)

### 7.1 Document Observer

- Detecta mudanças no documento.
- Extrai deltas.
- Atualiza índice no WASM.

### 7.2 Execução (Task Loop)

```
for each step:
  context = wasm.query()
  result = agent.execute()
  applyToWord(result)
  log()
```

### 7.3 UI State Machine

Estados:

- Idle  
- Planning  
- Executing  
- Error  
- Completed  

Eventos exibidos ao usuário:

- Step atual  
- Logs  
- Prévia de ações  
- Status do índice (Idle/Indexando)

---

# 8. Wing Audit Log

### 8.1 Estrutura

```
{
  timestamp,
  stepId,
  agentId,
  contextUsed,
  output,
  beforeAfterDiff
}
```

### 8.2 Objetivo

- Auditabilidade  
- Confiabilidade jurídica  
- Explainability  

---

# 9. Security Model

- Nenhum texto é enviado para a nuvem sem aprovação explícita.
- Embeddings são gerados localmente.
- Dados sensíveis permanecem no cliente.
- Comunicação backend criptografada TLS 1.2+.

---

# 10. Versionamento e Futuro

### 10.1 V1 (Atual RFC)
- WASM + embeddings locais.
- IndexedDB como storage.
- Maestro linear.
- Personas fixas.

### 10.2 V2
- Serviço local opcional (Rust) com armazenamento ilimitado.
- Mais personas.
- Suporte a workflows condicionais.

### 10.3 V3
- Suporte a modelos locais maiores (LLM on-device).
- Sincronização inteligente entre dispositivos.

---

# 11. Conclusão

Wing 1.0 define uma arquitetura inédita no ecossistema Office:  
**AI híbrida, com memória local, orquestração determinística, agentes especializados e auditabilidade completa.**

Este RFC formaliza a base para expansão futura, permitindo que Wing evolua para o primeiro **Copilot Local Profissional** do mundo.
