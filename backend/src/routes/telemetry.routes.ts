import { Router } from "../deps.ts";
import { track } from "../services/telemetry.ts";
import { optionalWingSession } from "../middlewares/authMiddleware.ts";

const router = new Router();
router.use(optionalWingSession);

// Ingestão best-effort de eventos client-side (RFC 014 §8). Eventos sem sessão
// permanecem anônimos; um Bearer inválido é rejeitado. Nunca gravar texto do
// documento aqui.
router.post("/", async (ctx: any) => {
  const { eventName, properties } = await ctx.request.body.json();

  if (!eventName || typeof eventName !== "string") {
    ctx.response.status = 400;
    ctx.response.body = { error: "eventName é obrigatório." };
    return;
  }

  const accountId = ctx.state.auth?.accountId as string | undefined;
  track(eventName, properties, accountId);
  ctx.response.status = 202;
  ctx.response.body = { ok: true };
});

export default router;
