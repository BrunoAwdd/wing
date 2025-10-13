import { Application, Router, oakCors } from "./deps.ts";
import logger from "./services/logger.ts";
// import apiRouter from "./routes/api.routes.ts"; // Não vamos mais usar o roteador importado
import chatRouter from "./routes/chat.routes.ts";
import authRouter from "./routes/auth.routes.ts";

// Dependências que estavam em api.routes.ts
import { apiLimiter } from "./middlewares/rateLimiter.ts";
import { handleStreamRequest } from "./services/requestHandler.ts";
import {
  PromptBuilder,
  buildFixPrompt,
  buildTranslatePrompt,
  buildSummarizePrompt,
  buildRewritePrompt,
} from "./prompts.ts";


// --- Configuração de Ambiente ---
const port = parseInt(Deno.env.get("PORT") || "3003");

// --- Inicialização da Aplicação ---
const app = new Application();

// --- Middlewares ---

// Middleware de log para depuração
app.use(async (ctx, next) => {
  console.log(`--> ${ctx.request.method} ${ctx.request.url.pathname}`);
  await next();
});

app.use(oakCors()); // Habilita CORS para todas as rotas

// Logger middleware
app.use(async (ctx, next) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  logger.info(`${ctx.request.method} ${ctx.request.url} - ${rt}`);
});

// Timing middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  ctx.response.headers.set("X-Response-Time", `${ms}ms`);
});


// --- Roteamento Centralizado ---
const rootRouter = new Router();

rootRouter.get("/", (ctx) => {
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
  rootRouter.post(`/api/v1/${actionName}`, (ctx) => 
    handleStreamRequest(ctx, promptBuilder, actionName)
  );
});


// Monta os outros roteadores
rootRouter.use("/api/v1/chat", chatRouter.routes(), chatRouter.allowedMethods());
rootRouter.use(authRouter.routes(), authRouter.allowedMethods()); // Rotas de auth na raiz

// Aplica o roteador principal à aplicação
app.use(rootRouter.routes());
app.use(rootRouter.allowedMethods());


// --- Inicialização do Servidor ---
app.addEventListener("listen", ({ hostname, port, secure }) => {
  logger.info(`Servidor backend rodando em ${secure ? "https://" : "http://"}${hostname ?? "localhost"}:${port}`);
});

await app.listen({ port });