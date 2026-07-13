# RFC 015 - Gateway de Pagamento e Assinaturas Stripe

**Status:** Proposto
**Autor:** Bruno Oliveira
**Data:** 2026-07-11
**Audiência:** Produto, Engenharia e Operações
**Depende de:** RFC 014

---

## 1. Decisão

O Wing usará Stripe Billing como gateway inicial, com:

- Stripe-hosted Checkout para contratação do plano Pro;
- webhooks assinados como fonte de verdade da assinatura;
- Stripe Customer Portal para atualização e cancelamento;
- Supabase para contas, assinaturas, uso e idempotência;
- sessão Wing autenticada para checkout, status e portal;
- plano Free com cota mensal e upgrade contextual.

Este RFC é somente planejamento. Nenhuma integração Stripe deve ser considerada implementada até que todos os critérios de aceite tenham sido verificados em ambiente de teste.

O Checkout hospedado reduz o escopo PCI do Wing e evita coleta direta de dados de cartão. A criação da sessão ocorre exclusivamente no backend. [Stripe Checkout](https://docs.stripe.com/api/checkout/sessions/create)

## 2. Fluxo

```text
Office SSO
   -> backend valida token Microsoft
   -> backend emite sessão Wing
   -> usuário solicita Checkout
   -> backend cria Checkout Session
   -> Stripe coleta pagamento
   -> Stripe envia webhook assinado
   -> backend atualiza assinatura no Supabase
   -> entitlement passa de Free para Pro
```

Gerenciamento:

```text
usuário autenticado
   -> backend cria sessão curta do Customer Portal
   -> usuário gerencia pagamento ou cancelamento no Stripe
   -> webhook atualiza o estado local
```

## 3. Endpoints

### `POST /api/v1/billing/checkout`

- exige `Authorization: Bearer <wing-session>`;
- usa a conta autenticada, nunca um e-mail arbitrário;
- cria sessão `mode=subscription`;
- envia `account_id` e `plan` em metadata;
- retorna somente a URL hospedada do Stripe.

### `POST /api/v1/billing/portal`

- exige sessão Wing;
- exige `stripe_customer_id` vinculado à conta;
- cria URL curta e descartável do Customer Portal.

### `GET /api/v1/billing/status`

- exige sessão Wing;
- retorna plano, estado e fim do período atual;
- não retorna identificadores ou dados de pagamento desnecessários.

### `POST /api/v1/billing/webhook`

- recebe corpo bruto;
- valida `Stripe-Signature` com HMAC-SHA256;
- rejeita eventos fora da tolerância temporal;
- processa eventos de forma idempotente;
- não exige sessão Wing.

## 4. Eventos processados

| Evento | Ação |
|---|---|
| `checkout.session.completed` | Vincular customer e sincronizar assinatura |
| `customer.subscription.created` | Criar ou atualizar assinatura |
| `customer.subscription.updated` | Atualizar plano, status e período |
| `customer.subscription.deleted` | Revogar entitlement pago |
| `customer.subscription.paused` | Suspender entitlement pago |
| `customer.subscription.resumed` | Restaurar estado recebido do Stripe |

Assinaturas mudam de forma assíncrona; por isso o webhook, e não a página de sucesso, é a autoridade. [Webhooks de assinatura](https://docs.stripe.com/billing/subscriptions/webhooks)

## 5. Segurança

- segredo Stripe existe apenas no backend;
- webhook verifica assinatura antes de interpretar o JSON;
- sessão Wing é assinada e possui expiração;
- token Microsoft é validado por assinatura, audiência, emissor e escopo;
- checkout e portal usam o `account_id` da sessão;
- evento é persistido antes e marcado como processado depois do commit lógico;
- retries do Stripe não duplicam provisionamento;
- payloads e tokens não são registrados em logs;
- ambiente de produção não aceita tokens dummy.

O Stripe envia a assinatura no header `Stripe-Signature` e recomenda validar cada evento recebido. [Assinatura de webhooks](https://docs.stripe.com/webhooks)

## 6. Configuração

Backend:

```text
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO=
STRIPE_SUCCESS_URL=
STRIPE_CANCEL_URL=
STRIPE_PORTAL_RETURN_URL=
JWT_SECRET=
MICROSOFT_TOKEN_AUDIENCE=
WING_FREE_MONTHLY_CREDITS=1000
WING_ACTION_MAX_OUTPUT_TOKENS=4096
WING_CHAT_MAX_OUTPUT_TOKENS=2048
```

Frontend:

```text
BACKEND_URL=
WING_FEATURE_DOCUMENT_DESIGN=false
WING_FEATURE_LEGAL_ANALYSIS=false
```

## 7. Persistência

### `accounts`

- identidade Microsoft estável;
- e-mail;
- `stripe_customer_id`.

### `subscriptions`

- `account_id`;
- ID externo da assinatura;
- provider;
- plano;
- status;
- período atual.

### `webhook_events`

- ID único do evento;
- tipo;
- payload;
- data de processamento;
- último erro.

### `usage_monthly`

- chamadas por conta e mês;
- tokens estimados;
- incremento atômico por função SQL.

## 8. Estados de assinatura

| Stripe | Entitlement Wing |
|---|---|
| `trialing` | Pro |
| `active` | Pro |
| `past_due` | Free e aviso de pagamento |
| `incomplete` | Free |
| `incomplete_expired` | Free |
| `unpaid` | Free |
| `paused` | Free |
| `canceled` | Free |

## 9. Experiência no Word

Na tela de configurações:

- conta e plano atual;
- uso do mês e limite Free;
- botão **Assinar Wing Pro** para contas Free;
- botão **Gerenciar assinatura** para clientes Stripe;
- estado de carregamento e erro;
- abertura do Checkout e Portal em janela externa segura.

O Stripe Customer Portal é uma interface hospedada e suas sessões devem ser criadas sob demanda. [Customer Portal](https://docs.stripe.com/api/customer_portal/sessions/create)

## 10. Testes mínimos

- parser e validação de assinatura Stripe;
- rejeição de assinatura inválida ou expirada;
- mapeamento de todos os estados de assinatura;
- período de API Stripe antigo e novo;
- idempotência de webhook;
- checkout sem autenticação retorna `401`;
- portal sem customer retorna erro controlado;
- cota Free bloqueia novas chamadas;
- assinatura ativa libera plano Pro;
- Visual Law e análise jurídica permanecem desligados.

## 11. Critérios de aceite

- Checkout de teste cria assinatura;
- webhook assinado atualiza o Supabase;
- evento repetido não duplica dados;
- plano muda para Pro sem ação manual;
- cancelamento retorna a conta ao Free;
- portal abre somente para a própria conta;
- nenhuma chave Stripe aparece no bundle;
- todos os testes e checks passam;
- documentação de configuração permite repetir o setup.

## 12. Fora do escopo

- cobrança por consumo;
- múltiplos preços ou moedas;
- plano Team e gestão de assentos;
- cupons administrados pelo Wing;
- notas fiscais brasileiras;
- recuperação customizada de inadimplência;
- monetização pelo Microsoft Marketplace.
