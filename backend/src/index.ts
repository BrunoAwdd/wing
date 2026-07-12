import { Application, Router, oakCors, Context } from "./deps.ts";
import logger from "./services/logger.ts";
import chatRouter from "./routes/chat.routes.ts";
import legalRouter from "./routes/legal.routes.ts";
import designRouter from "./routes/design.routes.ts";
import authRouter from "./routes/auth.routes.ts";
import { agentsService } from "./services/agentsService.ts";
import { extensionRegistry } from "./services/extensionRegistry.ts";
import { maestroService } from "./services/maestroService.ts";

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
    optionsSuccessStatus: 200,
  })
);

// Logger middleware
app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  await next();
  const rt = ctx.response.headers.get("X-Response-Time");
  logger.info(
    `${ctx.request.method} ${ctx.request.url} - ${ctx.response.status} - ${rt}`
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
    (ctx: Context) => handleStreamRequest(ctx, promptBuilder, actionName)
  );
});

// Maestro Route
rootRouter.post("/api/maestro/plan", async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { instruction, context, options } = body;

    if (!instruction) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Instruction is required" };
      return;
    }

    const plan = await maestroService.generatePlan(
      instruction,
      context || [],
      options
    );
    ctx.response.body = plan;
  } catch (error) {
    console.error("Maestro Error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to generate plan" };
  }
});

// Agents Route
rootRouter.post("/api/agent/execute", async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { agentId, instruction, context } = body;

    if (!agentId || !instruction) {
      ctx.response.status = 400;
      ctx.response.body = { error: "agentId and instruction are required" };
      return;
    }

    const response = await agentsService.executeAgent(
      agentId,
      instruction,
      context || []
    );
    ctx.response.body = response;
  } catch (error) {
    console.error("Agent Error:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: error instanceof Error ? error.message : "Failed to execute agent",
    };
  }
});

// Monta os outros roteadores
rootRouter.use(
  "/api/v1/chat",
  chatRouter.routes(),
  chatRouter.allowedMethods()
);
// RFC 013: Visual Law e análise jurídica estruturada ficam incubadas —
// desligadas por padrão. Rota só é registrada com a flag em "true", então
// fica 404 real (não apenas escondida) enquanto a feature não é reativada.
if (Deno.env.get("WING_FEATURE_LEGAL_ANALYSIS") === "true") {
  rootRouter.use(
    "/api/v1/legal",
    legalRouter.routes(),
    legalRouter.allowedMethods()
  );
}
if (Deno.env.get("WING_FEATURE_DOCUMENT_DESIGN") === "true") {
  rootRouter.use(
    "/api/v1/design",
    designRouter.routes(),
    designRouter.allowedMethods()
  );
}
rootRouter.use(authRouter.routes(), authRouter.allowedMethods()); // Rotas de auth na raiz

// Initialize Extensions
await extensionRegistry.loadExtensions();

// Extension Management Routes (Public for now, or use specific auth later)
rootRouter.post("/api/extensions/agent", async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { name, category, systemPrompt } = body;

    if (!name || !systemPrompt) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Name and System Prompt are required" };
      return;
    }

    const id = name.toLowerCase().replace(/\s+/g, "-");
    const manifest = {
      id: `wing.user.${id}`,
      version: "1.0.0",
      type: "agent",
      config: {
        visibleName: name,
        category: category || "User",
        manifest: {
          id: id,
          display_name: name,
          model: "gemini-pro",
          system_prompt: systemPrompt,
          actions: [],
          triggers: [],
          input_schema: {
            instruction: "string",
            context: "array",
          },
          output_schema: {
            thought_process: "string",
            action_payload: {},
          },
        },
      },
    };

    // @ts-ignore: manifest type mismatch workaround for now
    await extensionRegistry.createAgentExtension(manifest);

    ctx.response.body = { status: "created", agentId: id };
  } catch (error) {
    console.error("Create Agent Error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create agent" };
  }
});

rootRouter.get("/api/extensions/agent", (ctx: Context) => {
  const agents = extensionRegistry.getAgents();
  ctx.response.body = Object.values(agents);
});

// Microsoft Auth Route
import { microsoftLicensingService } from "./services/microsoftLicensingService.ts";

rootRouter.post("/api/auth/microsoft", async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { token } = body;

    if (!token) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Token is required" };
      return;
    }

    const result = await microsoftLicensingService.syncLicense(token);
    ctx.response.body = result;
  } catch (error) {
    console.error("Microsoft Auth Error:", error);
    ctx.response.status = 401;
    ctx.response.body = { error: "Failed to authenticate with Microsoft" };
  }
});

// Enterprise / Admin Routes
import { rbacMiddleware } from "./middlewares/rbacMiddleware.ts";
import { wingLocalService } from "./services/wingLocalService.ts";

const adminRouter = new Router();
adminRouter.use(rbacMiddleware("Admin"));

adminRouter.post("/api/admin/secrets", async (ctx: Context) => {
  try {
    const body = await ctx.request.body.json();
    const { key, value } = body;
    await wingLocalService.storeSecurely(key, value);
    ctx.response.body = { status: "stored", key };
  } catch (e) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to store secret" };
  }
});

adminRouter.get("/api/admin/secrets/:key", async (ctx: any) => {
  const key = ctx.params.key;
  const value = await wingLocalService.retrieveSecurely(key);
  if (value) {
    ctx.response.body = { key, value };
  } else {
    ctx.response.status = 404;
    ctx.response.body = { error: "Secret not found" };
  }
});

// MCP Routes (External Client)
import mcpRouter from "./routes/mcpRoutes.ts";
rootRouter.use("/api/mcp", mcpRouter.routes(), mcpRouter.allowedMethods());

rootRouter.use(adminRouter.routes(), adminRouter.allowedMethods());

// Aplica o roteador principal à aplicação
app.use(rootRouter.routes());
app.use(rootRouter.allowedMethods());

// --- Inicialização do Servidor ---
app.addEventListener("listen", ({ hostname, port, secure }) => {
  logger.info(
    `Servidor backend rodando em ${secure ? "https://" : "http://"}${hostname ?? "localhost"
    }:${port}`
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
