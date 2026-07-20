# Deploy do Robbie em VPS (Docker Compose + Caddy)

Cobre o item pendente do M5: "validar certificados, secrets, health check e
observabilidade". Backend, add-in e site são containers independentes,
expostos apenas em `127.0.0.1`. O Caddy fala HTTPS com o mundo, roteia os
domínios e renova os certificados Let's Encrypt automaticamente.

## 1. Pré-requisitos na VPS

- DNS de `robbie-api.awdd.com.br` e `robbie.awdd.com.br` apontando para o IP
  da VPS (A/AAAA),
  propagado antes de subir o Caddy — sem isso o desafio ACME do Let's
  Encrypt falha.
- Portas 80 e 443 liberadas no firewall (80 é usado pelo desafio ACME).
- Docker Engine com o plugin Compose instalado.
- Caddy instalado (`apt install caddy` ou pacote oficial).

## 2. Configuração e containers

```bash
git clone <repositorio-do-robbie> /opt/wing
cd /opt/wing
cp backend/.env.production.example backend/.env.production
# preencher backend/.env.production com os secrets reais
backend/deploy/deploy.sh
```

O boot falha imediatamente (`Deno.exit(1)`, log claro em `docker compose logs`) se
qualquer secret obrigatório estiver faltando — ver
[`backend/src/config/requiredEnv.ts`](../backend/src/config/requiredEnv.ts).
Não adianta subir o serviço sem `.env.production` completo.

As imagens são construídas pelo GitHub Actions depois que backend, add-in e
site passam no CI da `main`. O workflow publica no GHCR as tags `latest` e
`sha-<commit>`. A VPS apenas baixa as imagens; não compila Deno, Node ou Rust.

Os containers ficam disponíveis somente em `127.0.0.1:3005` (API), `:8081`
(add-in) e `:8080` (site); essas portas não devem ser abertas no firewall.

Se os pacotes GHCR estiverem privados, crie um token GitHub com
`read:packages` e execute:

```bash
export GHCR_USERNAME=brunoawdd
export GHCR_TOKEN=<token>
backend/deploy/deploy.sh
```

Para fixar uma versão ou fazer rollback, use a tag imutável do commit:

```bash
IMAGE_TAG=sha-<commit-completo> backend/deploy/deploy.sh
```

## 3. Caddy (TLS e roteamento)

```bash
sudo backend/deploy/provision-tls.sh
```

Caddy obtém e renova o certificado Let's Encrypt sozinho na primeira
requisição. O script valida DNS e dependências, instala o `Caddyfile`, aciona
o serviço e confirma o certificado servido. Não precisa (e não deve) copiar
`cert.pem`/`key.pem` para a VPS; esses arquivos não são lidos pelo backend.

## 4. Checklist de validação pós-deploy

- [ ] `docker compose -f backend/deploy/docker-compose.production.yml ps` →
  três serviços `running`/`healthy`, sem reinícios repetidos.
- [ ] `curl -s https://robbie-api.awdd.com.br/health` → `200` com
  `{"status":"ok", ...}`.
- [ ] `curl -vI https://robbie-api.awdd.com.br/health 2>&1 | grep -i "SSL certificate verify ok\|subject:"` →
  confirma que o certificado servido é o real de `robbie-api.awdd.com.br`
  (emitido por Let's Encrypt), não o self-signed de `CN=localhost`.
- [ ] `curl -si -H 'Origin: https://robbie.awdd.com.br' https://robbie-api.awdd.com.br/health`
  recebe `Access-Control-Allow-Origin: https://robbie.awdd.com.br`;
  `curl -si -H 'Origin: https://example.invalid' https://robbie-api.awdd.com.br/health`
  não recebe esse header (ver item já coberto no roadmap sobre CORS).
- [ ] `docker compose -f backend/deploy/docker-compose.production.yml logs --tail=100 backend`
  não mostra erros de
  secrets ausentes nem stack traces no boot.
- [ ] `sudo systemctl status caddy` → `active (running)`, sem erros de ACME
  no `journalctl -u caddy`.

Só depois desse checklist verde faz sentido rodar o roteiro de smoke test em
[`DOCS/MANUAL_TEST_ROTEIRO.md`](MANUAL_TEST_ROTEIRO.md) — testar o add-in
contra um backend com certificado inválido ou secret faltando desperdiça o
tempo do smoke test manual.
