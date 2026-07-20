FROM denoland/deno:2.5.4

WORKDIR /app

COPY backend/deno.json backend/deno.lock ./
COPY backend/src ./src

RUN deno cache src/index.ts

ENV NODE_ENV=production \
    PORT=3005

USER deno
EXPOSE 3005

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD deno eval "const r = await fetch('http://127.0.0.1:3005/health'); if (!r.ok) Deno.exit(1)"

CMD ["run", "--allow-net", "--allow-env", "--allow-read", "src/index.ts"]
