# RFC 005 — Persistence & Index Policy (Wing Memory & Storage Layer)
**Status:** Draft 1.0  
**Autor:** Bruno Oliveira  
**Componentes:** Wing Memory Engine, Client Engine, IndexedDB, (Futuro) Wing Local Service  
**Data:** 29/11/2025  
**Audiência:** Engenharia, Arquitetura, Segurança, Produto Enterprise  

---

## 1. Propósito

Este RFC define a **política oficial de persistência** e o modelo de armazenamento do Wing 1.0, abrangendo:

- como o índice vetorial (Wing Memory Engine) é persistido  
- como os documentos são identificados  
- como o espaço é gerenciado (limites, LRU, limpeza)  
- como a privacidade é garantida  
- como o futuro **Wing Local Service** se integra a este modelo

O objetivo é equilibrar:

- **privacidade** (tudo local)  
- **performance** (reativação rápida do índice)  
- **limites reais de storage** (ex.: ~50MB por origem no navegador)  

---

## 2. Metas e Não-Metas

### 2.1 Metas

O sistema de persistência **DEVE**:

1. Permitir restaurar o índice vetorial de um documento sem reprocessar todo o texto.  
2. Operar inteiramente no cliente (Office.js / Browser).  
3. Tratar cada documento de forma independente via `docId`.  
4. Respeitar limites de espaço, usando políticas como **LRU (Least Recently Used)**.  
5. Ser robusto a versões diferentes do formato de snapshot.  
6. Permitir evolução futura para um serviço local mais poderoso.  

### 2.2 Não-Metas

O sistema **NÃO DEVE**:

1. Armazenar o texto integral do documento como “verdade”.  
2. Substituir o documento original — o Word continua sendo a fonte de verdade.  
3. Implementar sincronização multi-dispositivo neste estágio (V1).  
4. Implementar criptografia complexa na camada IndexedDB (isso fica para o Wing Local Service).  

---

## 3. Modelo Lógico de Persistência

### 3.1 Princípio central

> O índice vetorial é um **cache de contexto** — não o documento em si.

- O documento “real” continua no Word (arquivo .docx, SharePoint, etc.).  
- O snapshot do Wing é apenas um atalho para não reindexar tudo.  

### 3.2 Unidades de Persistência

Cada unidade persistida é:

- **um documento Word**  
- identificado por um `docId` estável  
- associado a um snapshot binário do Wing Memory Engine  

---

## 4. Identificação de Documentos (`docId`)

### 4.1 Estratégia

Cada documento recebe um `docId` único e estável:

- Na primeira abertura:
  - gerar um `UUIDv4` (`crypto.randomUUID()` no TS)  
  - salvar esse ID em `Office.context.document.settings`  
- Nas próximas aberturas:
  - ler o `docId` das settings  
  - se não existir (casos raros), gerar novamente  

### 4.2 Requisitos

- `docId` **NÃO DEVE** depender apenas do nome do arquivo (pode mudar).  
- `docId` **DEVE** ser opaco (sem informação sensível).  
- `docId` **DEVE** ser a chave primária na IndexedDB para aquela entrada de snapshot.  

---

## 5. Formato do Snapshot (Visão Geral)

O Wing Memory Engine fornece um **blob binário** (`Uint8Array`) resultante de `serialize()`.

Formato sugerido (nivel alto):

1. `version: u8` — versão do formato de snapshot.  
2. `dim: u16` ou `u32` — dimensão dos vetores.  
3. `entry_count: u32` — quantidade de entradas.  
4. Para cada entrada:
   - `id: u32`  
   - `text_len: u32`  
   - `text_bytes: [u8; text_len]` (UTF-8)  
   - `embedding: [f32; dim]`  

**Observação:**  
Em V1, podemos armazenar texto completo do chunk por praticidade. Em V2, podemos opcionalmente armazenar apenas hashes ou previews, dependendo de espaço.

---

## 6. IndexedDB — Estrutura e Política

### 6.1 Estrutura da Store

Exemplo de estrutura lógica:

```ts
interface WingIndexRecord {
  id: string        // docId
  blob: Uint8Array  // snapshot serializado
  updatedAt: number // timestamp
  size: number      // tamanho aproximado em bytes
}
```

- Database: `wing-index`  
- Object store: `documents`  
- KeyPath: `id`  

### 6.2 Operações Básicas

- **Salvar**: `put(record)`  
- **Ler**: `get(docId)`  
- **Listar todos**: `getAll()` ou `openCursor()`  
- **Remover**: `delete(docId)`  

---

## 7. Política de Espaço e Limites

### 7.1 Limite de Storage

Considerando um limite típico de **~50MB por origem** no navegador:

- Cada documento pode ocupar algo como 1–3 MB na média.  
- O sistema deve considerar **um teto alvo** (ex.: 35–40 MB) para evitar erros de quota.

### 7.2 LRU (Least Recently Used)

A política de limpeza recomendada:

1. Ao salvar um novo snapshot:
   - calcular o tamanho (`blob.length`)  
   - somar ao total de registros existentes  
2. Se `total` > `MAX_BYTES` (ex.: 40MB):
   - listar registros ordenados por `updatedAt` (ascendente)  
   - ir apagando os mais antigos até voltar abaixo do limite  

### 7.3 Estratégia de Degradação

Se não for possível salvar pelo limite:

- O Client Engine **DEVE**:
  - avisar o usuário que o índice deste documento não será persistido  
  - continuar funcionando em memória RAM  
  - reindexar em próxima abertura se necessário  

---

## 8. Ciclo Completo de Persistência

### 8.1 Na abertura do documento

1. `docId = getOrCreateDocId()`  
2. `record = IndexedDB.get(docId)`  
3. Se `record` existir:
   - `wasm.load(record.blob)`  
   - índice restaurado rapidamente  
4. Se não existir:
   - extrair texto → chunking  
   - `wasm.ingest(chunks)`  
   - `snapshot = wasm.serialize()`  
   - salvar em IndexedDB (se possível)  

### 8.2 Durante edição

- Ao detectar mudanças relevantes (via observer e deltas):
  - atualizar índice incrementalmente  
  - em intervalos (ex.: debounce de 30–60s), chamar `serialize()` e `put` novamente  

### 8.3 Ao fechar o documento

- Não é estritamente necessário salvar nesse momento (o save incremental já fez o trabalho).  
- Opcionalmente, pode-se fazer um snapshot final.

---

## 9. Resiliência a Versões

### 9.1 Campo `version`

O primeiro byte do snapshot indica:

- versão do formato  
- compatibilidade com o código atual  

### 9.2 Comportamento em `load()`

- Se `version` for suportada: carregar normalmente.  
- Se `version` for desconhecida:
  - retornar erro amigável  
  - o Client Engine deve:
    - apagar o snapshot antigo  
    - reindexar o documento a partir do texto  
    - gerar novo snapshot na nova versão  

---

## 10. Wing Local Service (V2 e além)

### 10.1 Motivação

IndexedDB é suficiente para:

- usuários individuais  
- documentos moderados  
- uso leve/médio  

Para:

- escritórios grandes  
- dezenas/centenas de documentos ativos  
- demandas de auditoria e criptografia  

Entra o **Wing Local Service**.

### 10.2 Papel do Wing Local Service

- Rodar como serviço nativo em Rust (fora do navegador).  
- Armazenar índices em disco (ex.: SQLite ou formato próprio).  
- Prover uma API local (ex.: `http://localhost:PORT/`) com:
  - `POST /index`  
  - `POST /query`  
  - `GET /doc/:id`  
  - `DELETE /doc/:id`  

### 10.3 Integração com o Modelo Atual

O Client Engine:

- Primeiro tenta detectar se o Local Service está disponível.  
- Se sim:
  - usa o serviço para persistência e talvez para o próprio índice.  
- Se não:
  - recai no fluxo padrão IndexedDB descrito neste RFC.  

---

## 11. Segurança e Privacidade

### 11.1 IndexedDB

- Sandbox do navegador.  
- Acessível apenas pelo domínio do add-in.  
- Não criptografado por padrão, mas protegido pelo modelo de segurança do browser.

### 11.2 Wing Local Service

- V2 irá adicionar criptografia (ex.: AES-256) no armazenamento.  
- Controle de acesso local (ex.: apenas usuário atual da máquina).  
- Logs de acesso e erros podem ser agregados para auditoria.

---

## 12. Erros e Comportamento de Falha

### 12.1 Falha ao gravar IndexedDB

- Possíveis causas:
  - quota excedida  
  - usuário bloqueou storage  
- Comportamento:
  - logar erro  
  - notificar UI (modo “sem persistência”)  
  - continuar com índice apenas em RAM  

### 12.2 Falha ao carregar snapshot

- Snapshot corrompido ou incompatível:  
  - apagar registro  
  - reindexar documento  
  - gerar snapshot novo  

---

## 13. Roadmap

### V1 (atual)

- IndexedDB como store padrão.  
- Snapshots por `docId`.  
- LRU simples para limpeza.  

### V2

- Wing Local Service (opcional).  
- Criptografia transparente de índices.  
- Otimização de espaço (compressão, quantização mais agressiva).  

### V3

- Sincronização enterprise (em rede local ou servidor dedicado).  
- Políticas avançadas de retenção (por tipo de documento, pasta, cliente).  

---

## 14. Conclusão

A política de persistência do Wing é um dos pilares que permitem conciliar:

- **Privacidade** (tudo local)  
- **Velocidade** (reabertura instantânea do índice)  
- **Robustez** (compatível com ambientes corporativos restritivos)  

Este RFC formaliza essa camada, permitindo evolução planejada rumo ao **Wing Local Service** e à futura edição enterprise do produto.
