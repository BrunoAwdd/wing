# RFC 011 — Wing Marketplace & Ecosystem Architecture  
**Status:** Superseded by RFC 016

**Autor:** Bruno Oliveira  
**Componentes:** Wing Core, Personas, Add-ins, Plugins, Extensões, Wing Hub  
**Data:** 29/11/2025  
**Audiência:** Engenharia, Produto, Enterprise Partners, ISVs, CTOs de Escritórios**

---

# 1. Propósito

Este RFC define a arquitetura do **Wing Marketplace**, o ecossistema oficial que permitirá:

- plugins externos  
- personas customizadas  
- módulos especializados (advocacia, contabilidade, saúde, contratos, auditoria)  
- integração com ERPs, CRMs e softwares jurídicos  
- distribuição segura entre empresas e parceiros  

O objetivo é transformar o Wing em uma **plataforma completa**, não apenas um add-in.

---

# 2. Visão Geral do Ecossistema

O ecossistema é composto por:

1. **Wing Core (núcleo imutável)**  
2. **Wing Personas (perfil cognitivo)**  
3. **Wing Plugins (extensões funcionais)**  
4. **Wing Connectors (integrações externas)**  
5. **Wing Marketplace (distribuição e governança)**  

Arquitetura:

```
Wing Core
 ├── Personas
 ├── Plugins
 ├── Connectors
 └── Marketplace Registry
```

---

# 3. Wing Plugins (Extensões)

Plugins são pequenos módulos externos que estendem capacidades do Wing.

### 3.1 Tipos de plugins

- **Tools**: funções especializadas (ex.: gerar tabela, validar prazo, classificar cláusulas).
- **Transformers**: pós-processamento (ex.: formatar petição, converter para ABNT).
- **Pipelines**: conjuntos de steps automáticos pré-definidos.

### 3.2 Estrutura mínima

Cada plugin possui:

```json
{
  "id": "wing.plugin.prazos",
  "name": "Cálculo de Prazos",
  "version": "1.0.0",
  "entry": "index.js",
  "permissions": ["read", "write"],
  "personaOverride": false
}
```

### 3.3 Execução

Os plugins rodam:

- Parte no cliente (TS)  
- Parte no servidor (Node)  
- Parte no local service, se requerido

Sempre dentro do sandbox do Wing.

---

# 4. Wing Personas (Customização Cognitiva)

As personas podem ser:

- pré-instaladas  
- criadas por parceiros  
- personalizadas para cada tenant  

Cada persona define:

- tom  
- limites  
- estilo  
- funções permitidas  
- schema de output  

---

# 5. Wing Connectors (Integrações Externas)

Conectores permitem ao Wing acessar sistemas de terceiros, como:

- Projuris  
- CPJ  
- DataLegis  
- SEI  
- ERPs  
- CRMs jurídicos  
- bancos de dados internos  

### 5.1 Modelo de Conector

```json
{
  "id": "wing.connector.sei",
  "type": "fetch",
  "methods": ["searchProcesso", "downloadPDF"]
}
```

---

# 6. Wing Marketplace

O Marketplace é:

- registro público  
- catálogo de plugins  
- catálogo de personas  
- mecanismo de distribuição  
- controle de licenças  
- auditável  

### 6.1 Fluxo de publicação

1. Desenvolvedor cria plugin  
2. Envia para validação automática  
3. Passa por análise de segurança  
4. É publicado no catálogo  
5. Admins podem instalar em seus tenants  

### 6.2 Discovery

Usuários podem navegar por:

- categorias  
- setor (jurídico, contábil, corporativo)  
- popularidade  
- parceiros oficiais  

---

# 7. Segurança do Marketplace

Cada plugin:

- é assinado digitalmente  
- roda em sandbox isolado  
- tem permissões explícitas  
- não toca no documento sem permissão  
- não acessa Gemini diretamente (passa pelo Hub)  

Verificação:

- hash  
- integridade  
- origem  
- permissões declaradas  

---

# 8. Multi-Tenant Support

Cada tenant possui:

```
Tenant
 ├── InstalledPlugins
 ├── ActivePersonas
 ├── Connectors
 ├── License
 └── AuditLog
```

Admins podem:

- habilitar / desabilitar plugins  
- limitar personas por equipe  
- bloquear certos conectores  

---

# 9. Wing Hub (Registro Oficial)

O Wing Hub é um registro central semelhante ao npm, porém:

- 100% auditado  
- orientado a compliance  
- versão empresarial disponível  
- política de segurança rigorosa  

Funções:

- hospedagem de plugins  
- assinaturas  
- validação  
- analytics  
- rate limiting  
- update feeds  

---

# 10. Roadmap

### V1 — Base
- API de plugins  
- Personas customizáveis  
- Marketplace público beta  

### V2 — Ecosystem
- Connectors  
- Wing Hub privado para empresas  
- Certificação de parceiros  

### V3 — Network
- Marketplace on-premise  
- Plugins corporativos internos  
- Loja fechada para escritórios e tribunais  

---

# 11. Conclusão

O Wing Marketplace transforma o Wing em um ecossistema expansível:

- Plugins  
- Personas  
- Conectores  
- Multi-tenant  
- Segurança corporativa  

Garantindo que o Wing evolua para a **plataforma de produtividade jurídica mais poderosa do mundo**, com interoperabilidade, governança e extensibilidade real.
