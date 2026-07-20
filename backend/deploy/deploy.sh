#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.production.yml"
ENV_FILE="${SCRIPT_DIR}/../.env.production"
IMAGE_TAG="${IMAGE_TAG:-latest}"
export IMAGE_TAG

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não está instalado." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Crie ${ENV_FILE} com os secrets reais antes do deploy." >&2
  exit 1
fi

if [[ -n "${GHCR_TOKEN:-}" ]]; then
  echo "${GHCR_TOKEN}" | docker login ghcr.io \
    --username "${GHCR_USERNAME:-brunoawdd}" --password-stdin
fi

echo "Publicando imagens com a tag ${IMAGE_TAG}..."
docker compose -f "${COMPOSE_FILE}" config --quiet
docker compose -f "${COMPOSE_FILE}" pull
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans --wait
docker image prune -f >/dev/null
docker compose -f "${COMPOSE_FILE}" ps

echo "Deploy concluído com a tag ${IMAGE_TAG}."
echo "Execute sudo ${SCRIPT_DIR}/provision-tls.sh no primeiro deploy ou após alterar o Caddyfile."
