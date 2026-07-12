# RFC 006 — Wing Security & Privacy Model  
**Status:** Draft 1.0  
**Author:** Bruno Oliveira  
**Component:** Security, Privacy, Data Flow  
**Date:** 2025-11-29  
**Audience:** Engineering, Architecture, Compliance, Legal**

---

# 1. Overview

Este documento descreve o **Modelo de Segurança e Privacidade do Wing**, garantindo que o sistema opere com total proteção dos dados do usuário, atendendo requisitos corporativos e jurídicos.

Wing foi projetado para:

- Minimizar superfície de ataque  
- Reduzir exposição de dados privados  
- Evitar dependência de servidores para contexto local  
- Garantir auditabilidade completa  
- Assegurar conformidade com práticas corporativas de segurança  

---

# 2. Security Principles

1. **Local First**  
   Sempre processar contexto, embeddings e indexação no dispositivo do usuário.

2. **Zero Data Retention**  
   O backend nunca armazena:  
   - texto do documento  
   - histórico do usuário  
   - índices ou embeddings

3. **Explicit Transfer**  
   Apenas contexto aprovado pelo usuário pode ser enviado ao agente.

4. **Deterministic Orchestration**  
   A execução do workflow via Maestro é totalmente previsível e auditável.

5. **End-to-End Encryption**  
   Toda comunicação cliente ↔ backend usa TLS 1.2+.

6. **Local Isolation**  
   WASM opera em sandbox isolado do sistema operacional.

---

# 3. Threat Model

### 3.1 Atores maliciosos possíveis
- Atacante externo
- Add-in malicioso em segundo plano
- Ataques MITM
- Atores internos na infraestrutura da nuvem
- Malware local tentando acessar IndexedDB

### 3.2 Objetivos do atacante
- Obter texto do documento  
- Corromper o índice local  
- Enviar instruções falsas ao Maestro  
- Roubar logs de execução  

Wing mitiga todos com isolamento e política de dados mínimos.

---

# 4. Security Architecture

```
 ┌──────────────────────────────┐
 │         Word Editor          │
 └──────────────┬───────────────┘
                │ Office.js Sandbox
                ▼
 ┌──────────────────────────────┐
 │      Client Engine (TS)      │
 │ - Task Loop                  │
 │ - Estado                     │
 │ - Sanitização                │
 └──────────────┬───────────────┘
                │ WASM boundary
                ▼
 ┌──────────────────────────────┐
 │ Wing Memory Engine (WASM)    │
 │ - Embeddings locais          │
 │ - Sem rede                   │
 │ - Dados só em RAM            │
 └──────────────┬───────────────┘
                │ IndexedDB (sandbox)
                ▼
 ┌──────────────────────────────┐
 │     Snapshot Persistência     │
 │ - Criptografado futuro (V2)   │
 └──────────────┬───────────────┘
                │ HTTPS
                ▼
 ┌──────────────────────────────┐
 │     Node Backend (Orchestr.) │
 │ - Não guarda dados           │
 │ - Stateless                  │
 │ - Gemini Proxy               │
 └───────────────────────────────┘
```

---

# 5. Data Flow

### 5.1 Sempre local:
- Chunking  
- Embeddings  
- Indexação  
- Busca vetorial  
- Observação do documento  
- Serialização/deserialização de índice  

### 5.2 Enviado ao servidor (mínimo):
- Trechos selecionados para contexto  
- Instruções do usuário  
- Resultados parciais do workflow  

Nenhum dado é armazenado.

---

# 6. Security Controls

### 6.1 Sanitização
Todo conteúdo enviado ao agente é higienizado:

- remoção de macros  
- remoção de metadados ocultos  
- neutralização de encodings suspeitos  

### 6.2 Boundary Enforcement (WASM)
O WASM possui:

- zero acesso à rede  
- zero acesso ao disco  
- zero acesso ao ambiente externo  

### 6.3 Maestro Integrity
- workflow deve ser JSON válido  
- steps devem ser validados contra schema  
- desvio do plano é bloqueado

### 6.4 TLS Enforcement
Backend aceita apenas conexões criptografadas.

### 6.5 Origin Policies
Persistência é isolada por domínio/origem.

---

# 7. Persistence Security (V1 & V2)

## V1 — IndexedDB (já implementado)
- Armazenamento sandbox  
- Sem acesso direto do WASM  
- Dados só acessíveis pelo domínio do add-in  
- Capacidade limitada (~50MB)  
- Não criptografado (mas seguro no sandbox)

## V2 — Storage Local Service (opcional)
- Serviço Rust opcional instalado pelo usuário  
- Armazenamento criptografado AES-256  
- Suporte para múltiplos documentos  
- Latência mais baixa  
- Persistência ilimitada  
- Multi-device no futuro

---

# 8. Compliance & Legal

Wing atende:

### 8.1 Princípios de Privacidade
- Minimização  
- Localidade  
- Transparência  
- Controle do usuário  

### 8.2 Ambientes corporativos
- Compatível com auditorias  
- Logs de execução opcionais  
- Não acessa rede sem necessidade  

### 8.3 Ambientes jurídicos
- Mantém cadeias de custódia  
- Não envia documento integral  
- Logs permitem reconstrução de decisões  

---

# 9. External Integrations

- Gemini API usada como “stateless cognitive module”.  
- Sem armazenamento externo.  
- Sem cache de terceiros.  
- Sem transmissão de embeddings.

---

# 10. Roadmap de Segurança

### V1
- Privacidade local completa  
- Zero retenção  
- TLS partout  
- WASM isolado  

### V2
- Criptografia de snapshots  
- Serviço local opcional  
- Hardening do runtime do WASM  

### V3
- Multi-device sync opcional  
- Multi-user enterprise mode  
- Auditoria em rede local segura  

---

# 11. Conclusão

Wing opera em um modelo **privacy-first**, alinhado aos padrões jurídicos, corporativos e governamentais, garantindo:

- Zero exposição indevida  
- Execução determinística  
- Memória local protegida  
- Orquestração segura  
- Auditabilidade total  

Este RFC formaliza os pilares de segurança do Wing e serve como base para certificação e auditorias futuras.
