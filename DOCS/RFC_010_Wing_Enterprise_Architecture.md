# RFC 010 — Wing Enterprise Edition Architecture  
**Status:** Partially superseded by RFC 014 and RFC 016

**Autor:** Bruno Oliveira  
**Componentes:** Wing Memory Engine, Client Engine, Agents Hub, Maestro, Wing Local Service (Enterprise), Administração Central  
**Data:** 29/11/2025  
**Audiência:** Arquitetos, Engenharia Enterprise, Segurança da Informação, Compliance, CTOs de Escritórios/Empresas**

---

# 1. Propósito

Este RFC formaliza a **arquitetura completa da edição Enterprise do Wing**, criada para ambientes:

- corporativos  
- jurídicos de grande porte  
- escritórios de advocacia de alto volume  
- departamentos contábeis  
- ambientes regulados (financeiro, saúde, público)  

O Wing Enterprise adiciona:

- governança  
- política de acesso  
- logs auditáveis  
- criptografia local avançada  
- multi-tenancy  
- controle granular de personas e ferramentas  
- infraestrutura opcional **on-premise** para empresas restritas  

Este documento especifica tudo isso.

---

# 2. Metas e Não-Metas

## 2.1 Metas

A Enterprise Edition **DEVE**:

1. Prover armazenamento criptografado fora do navegador, via **Wing Local Service**.  
2. Suportar ambientes desconectados (“air-gapped”) com regras especiais.  
3. Oferecer controle de acesso por usuário, grupo e função.  
4. Permitir logs auditáveis ("quem pediu", "o que foi executado", "quando", "qual agente").  
5. Isolar dados entre departamentos (multi-tenant).  
6. Integrar com Active Directory / Azure AD / LDAP, como opcional.  
7. Permitir configurações avançadas de compliance.  

## 2.2 Não-Metas

A Enterprise Edition **NÃO DEVE**:

- substituir completamente a versão cloud (elas coexistem)  
- expor dados sensíveis para a nuvem sem autorização explícita  
- funcionar como DMS (Document Management System)  
- sincronizar documentos entre usuários  

---

# 3. Arquitetura Geral

```
                       ┌─────────────────────────┐
                       │   Painel Wing (UI/TS)    │
                       └───────────┬──────────────┘
                                   │
                                   ▼
                      ┌───────────────────────────┐
                      │     Client Engine          │
                      └───────────┬───────────────┘
                                  │
               ┌──────────────────┴───────────────┐
               ▼                                  ▼
   ┌──────────────────────────┐      ┌──────────────────────────┐
   │  Wing Memory Engine      │      │   Wing Local Service      │
   │     (WASM)               │      │   (Rust nativo)           │
   └──────────────┬───────────┘      └──────────┬───────────────┘
                  │                              │
                  ▼                              ▼
      ┌──────────────────────────┐   ┌──────────────────────────┐
      │      Agents Hub          │   │   Enterprise Controller   │
      │ (Gemini / Node backend)  │   │ (Autorização + Logs)     │
      └──────────────────────────┘   └──────────────────────────┘
```

---

# 4. Wing Local Service (Core Enterprise)

O **Wing Local Service (WLS)** é um serviço nativo em Rust que roda localmente na máquina ou no servidor interno da empresa.

### 4.1 Funções

- armazenamento criptografado dos índices  
- execução de ferramentas locais  
- auditoria central  
- controle de acesso baseado em permissões  
- políticas internas (retenção, limpeza, quotas)  

### 4.2 API Local

Endpoints sugeridos:

- `POST /index/set`  
- `GET /index/:docId`  
- `DELETE /index/:docId`  
- `POST /audit/log`  
- `POST /tools/execute`  

### 4.3 Segurança

- rodar apenas em localhost ou rede interna  
- autenticação local integrada com AD/LDAP  
- criptografia AES-256 no armazenamento  

---

# 5. Multi-Tenant Architecture

Cada tenant representa:

- um departamento  
- uma equipe  
- um escritório conectado  
- uma empresa diferente (em licenças MSP)

### Estrutura lógica:

```
Tenant
 ├── Users
 ├── Roles
 ├── Permissions
 ├── Logs
 └── Persona Policies
```

### Compartilhamento

- **NUNCA** compartilhar índices entre tenants  
- Personas e tools podem ser personalizadas por tenant  

---

# 6. Políticas de Acesso (RBAC)

### 6.1 Modelagem

- **Admin**  
  - controla licenças  
  - cria personas customizadas  
  - vê auditoria global  

- **Manager**  
  - controla equipe  
  - vê logs de sua unidade  

- **User**  
  - usa o Wing normalmente  
  - vê apenas seus logs  

### 6.2 Controle de Personas e Tools por Perfil

Exemplo:

```
Tenant X:
  User → Summary, Writer
  Manager → Summary, Writer, Legal
  Admin → todas as personas
```

---

# 7. Auditoria e Logs

O sistema Enterprise registra:

- step executado  
- persona usada  
- horário  
- ID do usuário  
- tamanho do contexto  
- tool invocada  
- erro (se houver)  

**Nunca registra:**

- texto completo do documento  
- embeddings  
- conteúdo sensível  

Logs podem ser armazenados:

- localmente  
- em servidor interno  
- em SIEM corporativo (Splunk, Elastic, Sentinel) via exportação  

---

# 8. Criptografia e Proteção de Dados

### 8.1 Wing Memory Engine (WASM)

- dados em RAM apenas  
- nunca criptografado (porque é transitório)

### 8.2 Wing Local Service

- AES-256 GCM  
- chaves gerenciadas via KMS interno (se disponível)  
- rotação periódica opcional  
- proteção contra replay  

---

# 9. Gemini e a Nuvem

Para empresas restritas:

- usar proxy corporativo  
- usar VPC-SC (Google)  
- usar instâncias dedicadas do modelo (se aplicável)  
- wing-local-mode (sem nuvem) opcional para ambientes militares/públicos sensíveis  

---

# 10. Configurações Avançadas Enterprise

### 10.1 Persona Policies

Permite:

- desativar certas personas  
- limitar outputs  
- restringir tools  

### 10.2 Compliance Policies

- retenção mínima de logs  
- exportação automática  
- limpeza programada de índices  
- bloqueio de escrita automática no documento  
- modo somente análise  

### 10.3 Execução Offline

Modo onde:

- WASM funciona normalmente  
- WLS funciona normalmente  
- Agents Hub fica desativado  
- Gemini substituído por persona offline (reduzida)  

---

# 11. Roadmap Enterprise

### V1 (fundação)
- Wing Local Service  
- criptografia local  
- RBAC básico  
- auditoria mínima  

### V2
- FIPS-compliant crypto  
- integração AD/LDAP  
- políticas avançadas de retenção  
- multi-backend corporativo  

### V3
- modo 100% on-premise  
- ferramentas avançadas offline  
- clusters Enterprise  
- gateway interno para múltiplas unidades  

---

# 12. Conclusão

O Wing Enterprise transforma o Wing:

De:  
um copiloto avançado para documentos Word  

Para:  
uma **plataforma corporativa completa**, com segurança, governança e controle, adequada para:

- departamentos jurídicos  
- escritórios de advocacia  
- contabilidade  
- bancos  
- seguradoras  
- órgãos públicos  
- ambientes regulados  

A arquitetura definida neste RFC garante:  
**privacidade, controle, extensibilidade, auditabilidade e conformidade corporativa.**
