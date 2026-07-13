# RFC 012 — Wing Security Model (Modelo de Segurança Completo)
**Status:** Partially superseded by RFC 014 and RFC 016

**Autor:** Bruno Oliveira  
**Componentes:** WASM, Wing Memory Engine, Agents Hub, Maestro, Wing Local Service, Marketplace  
**Data:** 29/11/2025  
**Audiência:** Segurança da Informação, Arquitetos, Compliance, TI Corporativo  

---

# 1. Propósito

Este documento formaliza o **modelo de segurança integral** do Wing, cobrindo:

- execução local (WASM)  
- comunicação cliente ↔ backend  
- políticas de isolamento  
- privacidade de documentos  
- criptografia  
- autenticação  
- auditoria  
- segurança do Marketplace  
- proteção contra vazamentos de conteúdo  

O objetivo é garantir que o Wing opere com segurança de nível **enterprise**, inclusive em ambientes altamente regulados.

---

# 2. Princípios de Segurança

1. **Zero Data Retention**  
   O Wing **não armazena** texto de documentos em nenhum servidor.

2. **Local First**  
   Tudo que puder rodar localmente (WASM) roda localmente.

3. **Isolamento Cognitivo**  
   Agentes nunca recebem mais contexto do que o estritamente necessário.

4. **Defense in Depth**  
   Camadas empilhadas: rede, criptografia, sandbox, permissões, auditoria.

5. **Least Privilege**  
   Plugins, personas e ferramentas só acessam o mínimo necessário.

6. **Verificabilidade**  
   Logs auditáveis para ambientes jurídicos e corporativos.

---

# 3. Segurança do WASM (Wing Memory Engine)

### 3.1 Execução Local Isolada

O WASM roda dentro do navegador:

- sem acesso ao disco  
- sem acesso ao sistema operacional  
- sem acesso à rede externa  
- sandbox nativo do navegador  

**Garantia:**  
Nenhum trecho do documento sai do cliente sem permissão explícita.

### 3.2 Embeddings em RAM

- vetores ficam apenas na memória volátil  
- não persistem após fechar o Word  
- opcionalmente serializados criptografados via Local Service  

### 3.3 Proteção Contra Vazamento

O WASM **não contém código capaz de enviar dados para a rede**.  
Quem controla a comunicação é o Client Engine (TS), que possui regras rígidas.

---

# 4. Segurança da Comunicação

### 4.1 TLS 1.3 obrigatório

Toda comunicação entre:

- painel Wing  
- backend Wing (Agents Hub / Maestro)  
- CDN  

deve usar **HTTPS/TLS 1.3** com:

- HSTS  
- Perfect Forward Secrecy  
- Cipher Suites modernas  

### 4.2 CORS restritivo

Somente:

```
https://wing.ai
https://cdn.wing.ai
```

são permitidos.

Nenhum plugin pode alterar política de CORS.

---

# 5. Segurança do Agents Hub (Nuvem)

### 5.1 Validação Estrita

Agentes devem validar:

- agentId  
- payload  
- schema  
- limites  

Nenhum agente pode:

- ler documento completo  
- acessar WASM diretamente  
- escrever no cliente sem passar pelo Client Engine  

### 5.2 Rate Limiting

Evita uso abusivo:

- limites por IP  
- limites por tenant  
- throttling inteligente  

### 5.3 Gemini Isolation Layer

Nenhum pedido para o modelo Gemini contém:

- documento inteiro  
- informações sensíveis não autorizadas  
- dados não vetorizados além do contexto mínimo  

Somente **trechos relevantes** (200–350 tokens) são enviados.

---

# 6. Segurança do Maestro

### 6.1 Plano Determinístico

O Maestro:

- não executa ações  
- não acessa contexto bruto  
- não conversa com WASM  

Ele apenas:

- monta steps  
- define ordem  
- valida schemas  

### 6.2 Isolamento Cognitivo

O Maestro nunca vê:

- documento completo  
- embeddings  
- dados de usuários  

Somente:

```
instrução do usuário
nomes dos agentes disponíveis
```

---

# 7. Wing Local Service (Enterprise)

### 7.1 Armazenamento Criptografado

Índices corporativos podem ser armazenados em AES-256-GCM.

### 7.2 Autenticação Integrada

- SSO  
- AD/LDAP  
- OAuth2 interno  

### 7.3 Firewall Local

Opcionalmente:

- restringir comunicação apenas ao painel Wing  
- bloquear saída para nuvem  
- exigir modo offline  

---

# 8. Segurança do Marketplace

### 8.1 Plugins Assinados

Todo plugin:

- possui assinatura digital  
- é verificado no load  
- tem hash validado  

### 8.2 Permissões Granulares

Plugins só podem acessar:

- tools permitidas  
- contexto vetorial filtrado  
- APIs expostas no Wing Core  

### 8.3 Sandbox

Plugins rodam:

- isolados  
- sem acesso ao DOM externo  
- sem acesso ao documento completo  
- sem acesso ao Gemini  

---

# 9. Proteção de Conteúdo

### 9.1 Nuvem nunca recebe documento inteiro

Política imutável.

### 9.2 Filtragem automática

Antes de enviar qualquer trecho ao backend, o Wing verifica:

- tamanho  
- sensibilidade  
- pertinência  

### 9.3 Descarte imediato

Os trechos são usados uma única vez pelo agente e descartados.

---

# 10. Auditoria

### 10.1 Resumo do que é auditado

São registrados:

- persona usada  
- horário  
- operação  
- tamanho do contexto  
- tool chamada  
- saída do agente (exceto conteúdo sensível)  
- ID do usuário  

### 10.2 O que nunca é auditado

- texto do documento  
- embeddings  
- dados pessoais do documento  

---

# 11. Proteções Contra Ataques

### 11.1 Entrada maliciosa

- sanitização  
- limite de tamanho  
- análise heurística  

### 11.2 Plugins maliciosos

- assinatura digital obrigatória  
- permissões limitadas  
- execução isolada  

### 11.3 Evasão de sandbox

- CSP rígida  
- bloqueio de eval()  
- import maps restritos  

---

# 12. Roadmap de Segurança

### V1
- TLS + CORS + Sandbox WASM  
- proteção cognitiva mínima  

### V2
- FIPS 140-2  
- Zero-Knowledge Index Encryption  
- rotinas antifraude de plugins  

### V3
- modo militar/offline  
- compatibilidade com normas internacionais  
- validação remota de integridade  

---

# 13. Conclusão

O Wing adota um modelo de segurança multi-camada, garantindo:

- privacidade absoluta  
- governança corporativa  
- isolamento cognitivo  
- proteção contra vazamentos  
- segurança para ambientes jurídicos e regulados  
- extensibilidade segura via Marketplace  

Este RFC formaliza o compromisso do Wing com **segurança, privacidade e compliance de nível mundial**.
