# RFC 009 — Wing Deployment & Distribution Specification  
**Status:** Draft 1.0  
**Autor:** Bruno Oliveira  
**Componentes:** Office Add-in, CDN, Manifest XML, Node Backend, WASM, Segurança  
**Data:** 29/11/2025  
**Audiência:** Engenharia, DevOps, Arquitetura, Compliance, TI Corporativo  

---

# 1. Propósito

Este RFC define a **arquitetura de distribuição, instalação e atualização** do Wing.  
O Wing é um **Office Add-in** híbrido que roda parcialmente no Word (client-side) e parcialmente na nuvem (backend Gemini).  
Portanto, sua distribuição precisa atender simultaneamente:

- ambientes pessoais  
- ambientes corporativos restritivos  
- pipelines de CI/CD  
- políticas de segurança (Content Security Policy, HTTPS, Assinatura de manifestos)  

Este documento formaliza tudo isso.

---

# 2. Estrutura do Add-in (Office.js)

O Wing é composto por:

1. **Manifest XML (obrigatório)**  
   - define comandos, botões, permissões e endpoints  
2. **Frontend React/TS (UI Panel)**  
3. **WASM (Wing Memory Engine)**  
4. **Node.js Backend (Agents Hub + Maestro)**  
5. **CDN com assets estáticos**  

Arquitetura:

```text
Word (cliente)
   │ Manifest XML
   ▼
CDN (add-in)
   │ HTML/CSS/WASM/JS
   ▼
Node Backend (agentes)
   │ Gemini
   ▼
IA Orquestrada
```

---

# 3. Manifest XML — Requisitos

Cada implantação do Wing **DEVE** fornecer um manifesto válido Office.js.

Exemplo mínimo:

```xml
<OfficeApp xmlns="http://schemas.microsoft.com/office/appforoffice/1.1" ...>
  <Hosts>
    <Host Name="Document"/>
  </Hosts>
  <DefaultSettings>
    <SourceLocation DefaultValue="https://cdn.wing.ai/taskpane.html"/>
  </DefaultSettings>
</OfficeApp>
```

### Regras obrigatórias

- O manifesto **DEVE** estar hospedado em HTTPS.  
- O manifesto **NÃO PODE** usar caminhos relativos.  
- O manifesto **DEVE** apontar para o painel principal do Wing.  
- Deve declarar permissões adequadas (ReadWriteDocument).  

---

# 4. Hospedagem (CDN)

Todos os componentes estáticos do Wing ficam hospedados em:

- **CDN global** (Cloudflare, Vercel Edge, etc.)  
- **HTTPS obrigatório**  
- **CORS fechado** exclusivamente para Word  

### Requisitos

- WASM precisa de `application/wasm` MIME correto.  
- Manifest e assets devem ter cache-control configurado:  
  - `taskpane.js`: cache curto (1h)  
  - `wasm`: cache longo (1 mês)  
  - `manifest.xml`: **cache disabled**  

---

# 5. Backend (Node.js)

O backend do Wing é composto por:

- Agents Hub  
- Maestro Planning API  
- Logging/Audit (opcional)  

### Requisitos

- Respostas **sempre** `application/json`  
- CORS liberado apenas para o domínio do add-in  
- TLS obrigatório  
- Rate limit básico  

---

# 6. Instalação

## 6.1 Modo Individual (Developer / Sideload)

Usuário abre:

1. Word → Inserir → Suplementos → Carregar Suplemento  
2. Seleciona `manifest.xml` hospedado remotamente  

Ideal para:

- desenvolvedores  
- testers  
- beta users  

---

## 6.2 Modo Corporativo (Admin Center)

Para ambientes M365:

1. Admin acessa **Microsoft 365 Admin Center**  
2. Vai em “Deployment of Custom Add-ins”  
3. Faz upload do `manifest.xml`  
4. Escolhe público-alvo:
   - usuários específicos  
   - grupos  
   - organização inteira  

Este modo:

- garante rollout controlado  
- respeita políticas internas  
- permite remoção centralizada  

---

# 7. Atualizações do Wing

### Como o Wing versiona:

- O **manifest** aponta sempre para URLs estáveis.  
- Ao atualizar JS/WASM/UI:
  - fazer deploy do mesmo caminho (CDN)  
  - o painel será atualizado automaticamente  

### Política ideal

- Manifesto fixo  
- Assets rotativos via CDN com invalidation automático  
- Versionamento semantic:

```
wing-1.0/
wing-1.1/
wing-2.0/
```

O manifesto pode apontar para um alias:

```
/wing-latest/taskpane.html
```

---

# 8. Segurança na Distribuição

### 8.1 HTTPS obrigatório

Sem HTTPS, Word recusa o add-in.

### 8.2 CSP (Content Security Policy)

O Wing DEVE usar:

```
default-src 'self';
connect-src https://backend.wing.ai https://cdn.wing.ai;
script-src 'self';
style-src 'self' 'unsafe-inline';
worker-src 'self';
```

### 8.3 Integrity Checking

Opcionalmente:

- usar `integrity` em scripts hospedados  
- verificar `sha256` do WASM  

### 8.4 Nenhum dado sensível no manifesto

O manifesto **NÃO PODE** conter:

- chaves  
- tokens  
- credenciais  
- URLs internas confidenciais  

---

# 9. Política de Deployment Corporativo

### 9.1 Edge-First

Para alta performance:

- CDN edge  
- latência < 40ms global

### 9.2 Isolamento por Tenant

Cada tenant corporativo pode ter:

- seu próprio backend  
- suas próprias personas  
- suas próprias políticas de logging  

### 9.3 Ambiente Interno

Para empresas ultra restritas:

- hospedar o manifesto **on-premise**  
- hospedar o CDN **on-premise**  
- usar Wing Local Service (futuro)  
- backend Gemini configurado com proxy corporativo  

---

# 10. Logs, Telemetria e Auditoria (opcional)

O Wing só coleta telemetria se:

1. usuário corporativo permitir  
2. admin ativar  
3. versão enterprise estiver instalada  

Campos possíveis:

- uso de agentes  
- erros  
- versão do add-in  
- latência das operações  

Nunca coleta:

- texto do documento  
- embeddings  
- conteúdo gerado  

---

# 11. Roadmap

### V1 (Wing 1.0)
- Deploy via CDN  
- Manifest simples  
- Backend único  
- Atualização automática via CDN  

### V2
- Wing Local Service  
- Multi-backend  
- CDN privado  
- Política avançada de tenants  

### V3
- Marketplace de add-ins Wing  
- Multi-tenant integrado  
- Distribuição on-premise certificada  

---

# 12. Conclusão

O Wing precisa ser distribuído com **padrões enterprise**, garantindo:

- segurança  
- privacidade  
- atualizações rápidas  
- compatibilidade M365  
- pipelines CI/CD previsíveis  

Este RFC formaliza toda a base para implantação e distribuição em empresas, escritórios, órgãos públicos e ambientes regulados.
