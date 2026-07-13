import { Application, Context, oakCors, Router } from "./deps.ts";
import logger from "./services/logger.ts";
import chatRouter from "./routes/chat.routes.ts";
import legalRouter from "./routes/legal.routes.ts";
import designRouter from "./routes/design.routes.ts";
import telemetryRouter from "./routes/telemetry.routes.ts";
import authRouter from "./routes/auth.routes.ts";
import magicLinkAuthRouter from "./routes/magicLinkAuth.routes.ts";

// Dependências que estavam em api.routes.ts
import { apiLimiter } from "./middlewares/rateLimiter.ts";
import { requireWingSession } from "./middlewares/authMiddleware.ts";
import { handleStreamRequest } from "./services/requestHandler.ts";
import {
  buildFixPrompt,
  buildRewritePrompt,
  buildSummarizePrompt,
  buildTranslatePrompt,
  PromptBuilder,
} from "./prompts.ts";

// --- Configuração de Ambiente ---
const port = parseInt(Deno.env.get("PORT") || "3005");

// --- Inicialização da Aplicação ---
const app = new Application();

// --- Middlewares ---

// Middleware de log para depuração
app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  console.log(`--> ${ctx.request.method} ${ctx.request.url.pathname}`);
  await next();
});

// CORS Rígido (RFC 012)
app.use(
  oakCors({
    origin: [
      "https://localhost:3000", // Frontend Dev
      "https://localhost:3002", // Frontend Dev (Webpack default)
      "https://wing.ai", // Prod
      "null", // Office.js (Local)
    ],
    allowedHeaders: ["Content-Type", "Authorization"],
    methods: ["GET", "POST", "DELETE", "OPTIONS"],
    optionsSuccessStatus: 200,
  }),
);

// Logger middleware
app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  logger.info(
    `${ctx.request.method} ${ctx.request.url} - ${ctx.response.status} - ${rt}`,
  );
});

// Timing middleware
app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});

// --- Roteamento Centralizado ---
const rootRouter = new Router();

rootRouter.get("/", (ctx: Context) => {
  ctx.response.body = "Backend do Wing rodando com Deno e Oak!";
});

// Lógica de criação das rotas da API movida para cá
const promptBuilderMapping: { [key: string]: PromptBuilder } = {
  fix: buildFixPrompt,
  translate: buildTranslatePrompt,
  summarize: buildSummarizePrompt,
  rewrite: buildRewritePrompt,
};

Object.entries(promptBuilderMapping).forEach(([actionName, promptBuilder]) => {
  rootRouter.post(
    `/api/v1/${actionName}`,
    apiLimiter,
    requireWingSession,
    (ctx: Context) => handleStreamRequest(ctx, promptBuilder, actionName),
  );
});

// Monta os outros roteadores
rootRouter.use(
  "/api/v1/chat",
  chatRouter.routes(),
  chatRouter.allowedMethods(),
);
rootRouter.use(
  "/api/v1/telemetry",
  telemetryRouter.routes(),
  telemetryRouter.allowedMethods(),
);
rootRouter.use(
  "/api/v1/auth",
  apiLimiter,
  magicLinkAuthRouter.routes(),
  magicLinkAuthRouter.allowedMethods(),
);
// SSO Microsoft incubado (desligado por padrão) — a Wing agora vende direto
// via Stripe, sem depender do comércio da Microsoft Store, então login por
// e-mail (magic link) é o caminho padrão. O SSO Microsoft continua no
// código para reativação futura, mesmo padrão de flag do RFC 013: sem a
// flag em "true", a rota nem é registrada (404 real, não escondida).
if (Deno.env.get("WING_FEATURE_MICROSOFT_SSO") === "true") {
  rootRouter.use(
    "/api/v1/auth",
    apiLimiter,
    authRouter.routes(),
    authRouter.allowedMethods(),
  );
}
// RFC 013: Visual Law e análise jurídica estruturada ficam incubadas —
// desligadas por padrão. Rota só é registrada com a flag em "true", então
// fica 404 real (não apenas escondida) enquanto a feature não é reativada.
if (Deno.env.get("WING_FEATURE_LEGAL_ANALYSIS") === "true") {
  rootRouter.use(
    "/api/v1/legal",
    legalRouter.routes(),
    legalRouter.allowedMethods(),
  );
}
if (Deno.env.get("WING_FEATURE_DOCUMENT_DESIGN") === "true") {
  rootRouter.use(
    "/api/v1/design",
    designRouter.routes(),
    designRouter.allowedMethods(),
  );
}

// Aplica o roteador principal à aplicação
app.use(rootRouter.routes());
app.use(rootRouter.allowedMethods());

export { app };

// --- Inicialização do Servidor ---
// Guardado atrás de `import.meta.main` para que testes possam importar `app`
// (e usar `app.handle()`) sem abrir uma porta de verdade.
if (import.meta.main) {
  app.addEventListener("listen", ({ hostname, port, secure }) => {
    logger.info(
      `Servidor backend rodando em ${secure ? "https://" : "http://"}${
        hostname ?? "localhost"
      }:${port}`,
    );
  });

  // Determine if we are in development (NODE_ENV=development)
  // Treat any environment that is NOT explicitly "production" as development
  const isDev = Deno.env.get("NODE_ENV") !== "production";

  if (isDev) {
    // Development: use plain HTTP (no TLS) to avoid proxy EPROTO errors
    await app.listen({ port, secure: false });
  } else {
    // Production / secure mode: use HTTPS with self‑signed certs
    const sslOptions = {
      port,
      secure: true as const,
      cert: Deno.readTextFileSync("./cert.pem"),
      key: Deno.readTextFileSync("./key.pem"),
    };
    await app.listen(sslOptions);
  }
}
