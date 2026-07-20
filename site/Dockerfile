FROM node:20-alpine AS builder

WORKDIR /app
COPY site/package.json site/package-lock.json ./
RUN npm ci
COPY site ./

ARG VITE_API_BASE_URL=https://robbie-api.awdd.com.br
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

FROM nginx:1.27-alpine
COPY backend/deploy/nginx-site.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
