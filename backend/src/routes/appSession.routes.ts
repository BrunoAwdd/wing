import { type Context, Router } from "../deps.ts";
import {
  type AppSessionService,
  appSessionService,
} from "../services/appSessionService.ts";
import {
  getWingAuth,
  requireWingSession,
} from "../middlewares/authMiddleware.ts";

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const readJson = async (
  ctx: Context,
): Promise<Record<string, unknown> | null> => {
  try {
    return await ctx.request.body.json() as Record<string, unknown>;
  } catch {
    ctx.response.status = 400;
    ctx.response.body = { error: "Corpo JSON inválido." };
    return null;
  }
};

// M4.6: registro/heartbeat/encerramento do appSessionId por instância aberta
// do Word. Nunca aplica cap por conta — "sem limitar dispositivos, pessoas
// ou sessões por conta" é um requisito comercial explícito.
export const createAppSessionRouter = (
  service: AppSessionService = appSessionService,
) => {
  const router = new Router();

  router.use(requireWingSession);

  router.post("/", async (ctx) => {
    const body = await readJson(ctx);
    if (!body) return;

    const { documentId } = body;
    if (!isNonEmptyString(documentId)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "documentId é obrigatório." };
      return;
    }

    const auth = getWingAuth(ctx);
    const session = service.register(auth.accountId, documentId);
    ctx.response.status = 201;
    ctx.response.body = {
      appSessionId: session.appSessionId,
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  });

  router.post("/:id/heartbeat", (ctx) => {
    const auth = getWingAuth(ctx);
    const session = service.heartbeat(ctx.params.id!, auth.accountId);
    if (!session) {
      ctx.response.status = 404;
      ctx.response.body = {
        error: "Sessão de instância do Word não encontrada ou expirada.",
        code: "app_session_not_found",
      };
      return;
    }
    ctx.response.status = 200;
    ctx.response.body = {
      expiresAt: new Date(session.expiresAt).toISOString(),
    };
  });

  router.delete("/:id", (ctx) => {
    const auth = getWingAuth(ctx);
    // Best-effort e idempotente por natureza: quem chama pode estar
    // fechando a instância do Word em cima da hora (unload), então não faz
    // sentido diferenciar "já não existia" de "encerrada agora" — em ambos
    // os casos o estado final desejado (sessão fora do mapa) já é verdade.
    service.close(ctx.params.id!, auth.accountId);
    ctx.response.status = 204;
  });

  return router;
};

export default createAppSessionRouter();
