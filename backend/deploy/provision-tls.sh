#!/usr/bin/env bash
set -euo pipefail

API_DOMAIN="${WING_API_DOMAIN:-robbie-api.awdd.com.br}"
SITE_DOMAIN="${WING_SITE_DOMAIN:-robbie.awdd.com.br}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CADDYFILE="${SCRIPT_DIR}/Caddyfile"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Execute como root: sudo $0" >&2
  exit 1
fi

for command in caddy curl openssl systemctl; do
  if ! command -v "${command}" >/dev/null 2>&1; then
    echo "Comando obrigatório ausente: ${command}" >&2
    exit 1
  fi
done

for domain in "${API_DOMAIN}" "${SITE_DOMAIN}"; do
  if ! getent ahosts "${domain}" >/dev/null 2>&1; then
    echo "DNS ainda não resolve para ${domain}. Configure o registro A/AAAA antes." >&2
    exit 1
  fi
  if ! grep -Fq "${domain}" "${CADDYFILE}"; then
    echo "${CADDYFILE} não declara o domínio ${domain}." >&2
    exit 1
  fi
done

install -D -m 0644 "${CADDYFILE}" /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy

echo "Aguardando emissão dos certificados TLS..."
for attempt in $(seq 1 30); do
  if curl -sS -o /dev/null --connect-timeout 5 "https://${API_DOMAIN}/health" \
    && curl -sS -o /dev/null --connect-timeout 5 "https://${SITE_DOMAIN}/"; then
    for domain in "${API_DOMAIN}" "${SITE_DOMAIN}"; do
      openssl s_client -connect "${domain}:443" -servername "${domain}" </dev/null 2>/dev/null \
        | openssl x509 -noout -subject -issuer
    done
    echo "TLS provisionado para ${API_DOMAIN} e ${SITE_DOMAIN}."
    exit 0
  fi
  sleep 2
done

echo "O certificado não ficou disponível em 60 segundos." >&2
echo "Consulte: journalctl -u caddy -n 100 --no-pager" >&2
exit 1
