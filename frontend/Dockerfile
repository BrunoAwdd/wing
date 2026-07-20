FROM rust:1.95-bookworm AS wasm-builder

RUN cargo install wasm-pack --locked
WORKDIR /work
COPY wing-memory-engine ./wing-memory-engine
RUN RUSTFLAGS='--cfg=getrandom_backend="wasm_js"' \
  wasm-pack build ./wing-memory-engine --target web --out-dir /pkg

FROM node:20-bookworm AS web-builder

WORKDIR /work/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend ./
COPY --from=wasm-builder /pkg ./src/pkg

ARG BACKEND_URL=https://robbie-api.awdd.com.br
ARG PROD_APP_DOMAIN=https://robbie.awdd.com.br
RUN printf 'BACKEND_URL="%s"\nWING_FEATURE_DOCUMENT_DESIGN=false\nWING_FEATURE_LEGAL_ANALYSIS=false\nWING_FEATURE_MICROSOFT_SSO=false\n' \
  "${BACKEND_URL}" > .env \
  && PROD_APP_DOMAIN="${PROD_APP_DOMAIN}" npm run build

FROM nginx:1.27-alpine
COPY backend/deploy/nginx-addin.conf /etc/nginx/conf.d/default.conf
COPY --from=web-builder /work/frontend/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/taskpane.html || exit 1
