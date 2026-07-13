# Configuração de Identidade do Wing

Este documento descreve o contrato implementado no milestone M1.

## Fluxo

```text
Office.auth.getAccessToken()
  -> POST /api/v1/auth/session
  -> validação Microsoft por JWKS, assinatura e claims
  -> vínculo com a conta Wing no Supabase
  -> sessão Wing HS256 curta
  -> Authorization: Bearer <wing-session>
```

O token Microsoft é usado somente na troca inicial. O frontend mantém apenas a
sessão Wing em memória e solicita outra sessão ao Office SSO antes da expiração.

## Registro Microsoft Entra

O App Registration precisa:

1. expor o escopo `access_as_user`;
2. usar access tokens v2 (`requestedAccessTokenVersion: 2`);
3. pré-autorizar os clientes Microsoft Office;
4. possuir Application ID URI igual ao `<Resource>` do manifesto;
5. usar o Application ID como `<WebApplicationInfo><Id>` no manifesto.

Referências oficiais:

- [Registrar um Office Add-in para SSO](https://learn.microsoft.com/office/dev/add-ins/develop/register-sso-add-in-aad-v2)
- [Configurar SSO no manifesto](https://learn.microsoft.com/office/dev/add-ins/develop/sso-in-office-add-ins)
- [Validar claims de tokens Microsoft](https://learn.microsoft.com/entra/identity-platform/claims-validation)

## Backend

Variáveis obrigatórias:

```text
JWT_SECRET=<mínimo 32 bytes>
MICROSOFT_TOKEN_AUDIENCE=<Application ID do ambiente>
MICROSOFT_REQUIRED_SCOPE=access_as_user
WING_SESSION_ISSUER=wing-api
WING_SESSION_AUDIENCE=wing-office-addin
WING_SESSION_TTL_SECONDS=3600
```

Variáveis opcionais:

```text
MICROSOFT_ALLOWED_TENANTS=<tenant-id-1,tenant-id-2>
MICROSOFT_ALLOWED_CLIENT_IDS=<office-client-id-1,office-client-id-2>
```

Sem `MICROSOFT_ALLOWED_TENANTS`, o Wing aceita contas de qualquer tenant cuja
assinatura e demais claims sejam válidas. Sem `MICROSOFT_ALLOWED_CLIENT_IDS`, o
backend usa a allowlist oficial dos clientes Office suportados.

## Ambientes

O manifesto de desenvolvimento usa o Application ID
`7a24a432-030d-4b5b-aa68-7c25942557f9`. Portanto, o backend de desenvolvimento
usa esse valor em `MICROSOFT_TOKEN_AUDIENCE`.

Cada ambiente precisa de audiência e manifesto correspondentes. Nunca use o ID
de desenvolvimento como audiência de produção.

## Persistência

A migration `20260712_add_microsoft_identity.sql` adiciona:

- `accounts.microsoft_tenant_id`;
- `accounts.microsoft_object_id`;
- `accounts.display_name`;
- índice único para `(microsoft_tenant_id, microsoft_object_id)`.

O par tenant/object ID é a identidade estável. O e-mail pode mudar e não é
usado como credencial de autorização.

Contas legadas sem esses identificadores não são vinculadas automaticamente por
e-mail. Qualquer vínculo legado deve ser feito por uma migração administrativa
explícita e auditável.

## Invariantes

- o backend nunca confia em plano, conta, tenant ou papel enviados pelo cliente;
- tokens Microsoft e Wing não aparecem em logs ou telemetria;
- tokens Microsoft v1, expirados, com audience incorreta ou issuer inconsistente são rejeitados;
- todas as APIs comerciais exigem sessão Wing;
- login hardcoded, tokens dummy e autorização por header não fazem parte do runtime.
