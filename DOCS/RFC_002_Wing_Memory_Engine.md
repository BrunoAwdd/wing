# RFC 002 — Wing Memory Engine (Especificação Interna)
**Status:** Draft 1.0  
**Autor:** Bruno Oliveira  
**Componentes:** Rust/WASM, Embeddings, Vector Store, Persistência  
**Data:** 29/11/2025  
**Audiência:** Engenharia, Arquitetura, Performance, Segurança  

---

## 1. Propósito

Este RFC define, de forma completa, a arquitetura, responsabilidades e API do **Wing Memory Engine** — o núcleo local do Wing responsável por:

- gerar **embeddings** de texto no cliente (Word / navegador)  
- manter um **índice vetorial em memória (RAM)**  
- oferecer busca por **similaridade semântica** de baixa latência  
- permitir **persistência leve** via serialização e restauração do índice  
- operar com **privacidade total**, sem enviar conteúdo bruto para a nuvem  

---

## 2. Metas e Não-Metas

### 2.1 Metas

O Wing Memory Engine **DEVE**:

1. Rodar inteiramente em **Rust/WASM**, sem dependência de rede.  
2. Manter o índice vetorial **em RAM**, com acesso O(n) ou melhor na leitura.  
3. Gerar e consultar embeddings com **latência típica < 30 ms**.  
4. Oferecer uma **API estável** para o Client Engine.  
5. Suportar **atualização incremental** (delta).  
6. Permitir **serializar** o índice para IndexedDB.  
7. Operar totalmente isolado (sem disco, sem rede).  

### 2.2 Não-Metas

- Não é um banco vetorial completo.  
- Não armazena múltiplos documentos por si só.  
- Não implementa lógica de agentes.  
- Não persiste diretamente em disco.  

---

## 3. Arquitetura Geral

```text
Client TS (Word) ─── wasm-bindgen ───▶ Wing Memory Engine (Rust/WASM)
       │                                     │
       └────── persistência (IndexedDB) ◀────┘
```

Componentes:

- Motor de Embeddings (ONNX/Candle).  
- Vector Store em RAM.  
- Similaridade de Cosseno.  
- Serialização/deserialização.  
- API pública WASM.

---

## 4. Modelo de Dados

```rust
pub struct Entry {
    pub id: u32,
    pub text: String,
    pub embedding: Vec<f32>,
}

pub struct MemoryIndex {
    pub entries: Vec<Entry>,
    pub dim: usize,
    pub version: u8,
    pub next_id: u32,
}
```

---

## 5. Algoritmos

### 5.1 Chunking (TS)

- 200–350 tokens.  
- Sobreposição de 20 tokens.

### 5.2 Similaridade de Cosseno

```rust
fn cosine_similarity(a: &[f32], b: &[f32]) -> f32 {
    let mut dot = 0.0;
    for i in 0..a.len() {
        dot += a[i] * b[i];
    }
    dot
}
```

### 5.3 top_k

- Dotproduct contra todos os vetores.  
- Seleção parcial.

---

## 6. API Pública

### ingest

- Entrada: `Vec<String>`  
- Saída: `Vec<u32>`

### query

- Entrada: `query: String`, `top_k: u8`  
- Saída: `Vec<ResultItem>`

### delete_chunk

Remove um chunk.

### serialize

Gera snapshot binário.

### load

Reconstrói o estado.

---

## 7. Persistência

Via TypeScript:

- `serialize()` → `Uint8Array`  
- Salvo em IndexedDB por `docId`  
- `load()` na reabertura

Política: LRU quando atingir 50MB por origem.

---

## 8. Segurança

- WASM sem rede.  
- WASM sem disco.  
- Dados sensíveis só em RAM.  
- TS controla todo fluxo para nuvem.  

---

## 9. Erros

- Incompatibilidade de versão → solicitar reindexação.  
- Falha de modelo → fallback.  
- OOM → erro JS amigável.

---

## 10. Roadmap

### V1
- Modelo único.  
- Vector Store simples.  
- Serialize/load.

### V2
- Serviço local opcional.  
- Criptografia.

### V3
- Modelos múltiplos.  
- ANN opcional.  

---

## 11. Conclusão

O Wing Memory Engine fornece a base técnica para contexto local privado e rápido, sendo o coração do Wing 1.0 e o elemento que diferencia o produto de qualquer copilot tradicional.
