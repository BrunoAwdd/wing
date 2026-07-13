# 🟦 WING — ROADMAP TÉCNICO DEFINITIVO (Versão Refinada)

> **Histórico:** este roadmap foi substituído pelos RFCs 014 e 016. Agents Hub,
> Maestro, Extensions de agents e MCP foram aposentados. O roadmap comercial
> ativo está em `DOCS/COMMERCIAL_LAUNCH_ROADMAP.md`.

## Arquitetura Híbrida de Borda (Edge Hybrid)
**Memória, Recuperação e Observação → Local (Rust + WASM)**  
**Raciocínio, Orquestração e Geração → Nuvem (Node.js + Gemini)**  
**I/O e Execução → Client-Side (Office.js + React)**

---

# 🟩 FASE 1 — Núcleo Local (Rust/WASM) — “Wing Memory Engine”

🎯 **Objetivo:** Construir um motor de embeddings + busca vetorial 100% local, rápido, privado e incremental, rodando dentro do Word.

## 1.1 — Toolchain WASM (Rust → Word)
- Crate Rust com `cdylib`.
- `wasm-bindgen` + `wasm-pack` com target `web`.
- Compatibilidade garantida com runtime Office.js.
- O módulo deve carregar em **< 80 ms** em máquinas padrão.

**Resultado:** Wing tem “inteligência local” sem depender da nuvem.

## 1.2 — Motor de Inferência (Candle / ONNX Runtime)
Carregar modelo local pré-quantizado:

**Modelos recomendados:**
- `all-MiniLM-L6-v2-q8.onnx`
- ou versão `.gguf` ultra-compacta.

**Tamanho limite:** ≤ 40MB  
**Objetivo:** carregamento imediato e compatibilidade com ambientes corporativos.

Otimização: pré-carregar o modelo paralelamente enquanto a UI inicializa.

## 1.3 — Vector Store em RAM (In-Memory Index)
Implementar:

- Estrutura: `Vec<(id: u32, chunk: String, embed: Vec<f32>)>`
- Similaridade: **Cosine + SIMD**
- Chunking:
  - 200–350 tokens por chunk
  - sobreposição de 20 tokens (sliding window)
- Atualização incremental:
  - detectar trechos alterados
  - re-embed apenas os trechos novos
  - atualizar apenas os vetores modificados

**Objetivo:** manter o índice sempre atualizado sem reprocessar o documento inteiro.

## 1.4 — Ponte TS ↔ WASM (API Pública do Wing Memory Engine)
Métodos expostos:

```
ingest(chunks: Vec<String>) -> Vec<u32>
query(query: String, top_k: u8) -> Vec<ResultItem>
delete_chunk(id: u32)
serialize() -> JsValue
load(serialized: JsValue)
```

Permite persistência leve no navegador e sincronização do estado.

---

# 🟧 FASE 2 — “Wing Agents Hub” (Backend + Personas)

🎯 **Objetivo:** Criar o núcleo cognitivo do Wing: agentes especializados, estáveis e previsíveis.

## 2.1 — Arquitetura do Hub (Factory + Registry)
Criar um registro central:

```
interface AgentManifest {
  id: string
  system: string
  temperature: number
  allowedTools: string[]
  schema: any
}
```

Configurar cliente Gemini com:

- `responseMimeType: "application/json"`
- `safetySettings` restritivas (jurídico)
- `temperature`: definido por persona

## 2.2 — Personas Inicialmente Disponíveis
- **Legal** – Reescrita jurídica culta, parecer, petições.  
- **Audit** – Rastreio contábil, inconsistências.  
- **Writer** – Reescrita elegante e clara.  
- **Critic** – Avaliação técnica e refinamento.  
- **Summary** – Sínteses preservando rigor conceitual.

Cada persona possui:

- tom  
- limites  
- estilo  
- objetivos  
- schema obrigatório para output

## 2.3 — Endpoint de Execução Atômica

**POST `/api/agent/execute`**

Payload:

```
{
  "agentId": "Legal",
  "userInstruction": "reescreva a cláusula",
  "context": ["trecho 1", "trecho 2"],
  "previous": "conteúdo do último step"
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

# 🟦 FASE 3 — MAESTRO (Orquestração Cognitiva)

🎯 **Objetivo:** Transformar comandos complexos em **planos determinísticos**, compostos de steps executáveis.

## 3.1 — Maestro Planner

Entrada:

- instrução do usuário  
- agentes disponíveis  
- contexto do Rust  

Saída (JSON):

```
[
  {
    "stepId": 0,
    "agentId": "Summary",
    "topic": "Resumo inicial",
    "type": "analysis"
  },
  {
    "stepId": 1,
    "agentId": "Legal",
    "topic": "Reescrita técnica",
    "type": "rewrite"
  }
]
```

Regras:

- sem loops  
- sem ambiguidade  
- ordem linear  
- steps finitos  
- output validado via schema

## 3.2 — Endpoint do Plano

**POST `/api/maestro/plan`**

Retorna:

- plano  
- justificativa  
- estimativa de steps  
- pré-visualização  

O usuário pode editar/aceitar antes da execução.

---

# 🟪 FASE 4 — CLIENT ENGINE (Frontend/Word)

🎯 **Objetivo:** Coordenar UI, Rust e Backend com execução previsível e explicável.

## 4.1 — Document Observer
Monitorar mudanças com Office.js:

- `addHandlerAsync("documentSelectionChanged")`
- ao detectar mudança:
  - gerar delta  
  - reenviar para o Rust → atualizar índice

## 4.2 — Execução Recursiva (Task Loop)
Função principal:

```
async function executeWorkflow(plan) {
  for (step of plan) {
    const context = wasm.query(step.topic, top_k)
    const response = await executeAgent(step, context)
    await applyToWord(response)
    saveStepOutput(step.id, response)
  }
}
```

Inclui:

- busca vetorial  
- execução do agente  
- escrita no Word  
- acúmulo de estado  
- logs  

## 4.3 — UI State Machine
Estados:

- Idle  
- Planning  
- Executing  
- Error  
- Completed  

Mostrar em tempo real:

- step atual  
- ação  
- logs  
- preview  
- status do Rust: *Indexado / Atualizando / Idle*

## 4.4 — Wing Audit Log (Recomendado)
Registro local (JSON):

- agente usado  
- contexto aplicado  
- saída final  
- before/after do documento  

Garante rastreabilidade jurídica e técnica.

---

# 🔥 RESUMO FINAL (Versão Melhorada)

## Local (Rust/WASM)
- Embedding  
- Indexação incremental  
- Similaridade vetorial  
- Persistência leve  
- Alta performance  
- Privacidade total  

## Nuvem (Node + Gemini)
- Agentes especializados  
- Orquestração (Maestro)  
- JSON estruturado  

## Cliente (React + Office.js)
- Execução do workflow  
- UI inteligente  
- Ações no documento  
- Logs e auditoria  

---

# 🧨 RESULTADO: **WING 1.0 — O Primeiro “Copilot Local” do Mundo**

Você criou:

- Privacidade → **100% local**
- Inteligência → **100% orquestrada**
- Execução → **integrada ao Word**
- Previsibilidade → **JSON steps**
- Precisão jurídica → **Personas dedicadas**

Nenhum produto comercial combina essas vantagens.

---

Se quiser, posso escrever:

- RFC 0001 — Arquitetura Oficial do Wing  
- Diagrama completo (componentes + fluxos)  
- Documento para investidores / deck  

Só pedir.
