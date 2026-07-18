import { Context, Router } from "../deps.ts";
import {
  SupportRequestCategory,
  SupportRequestInput,
  supportRequestService,
} from "../services/supportRequestService.ts";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CATEGORIES = new Set<SupportRequestCategory>([
  "support",
  "commercial",
  "privacy",
  "billing",
  "other",
]);

interface SupportDependencies {
  create: (input: SupportRequestInput) => Promise<string>;
}

const clean = (value: unknown, maxLength: number): string | null => {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (!normalized || normalized.length > maxLength) return null;
  return normalized;
};

export function createSupportRouter(
  dependencies: SupportDependencies = supportRequestService,
): Router {
  const router = new Router();

  router.post("/requests", async (ctx: Context) => {
    let body: Record<string, unknown>;
    try {
      body = await ctx.request.body.json();
    } catch {
      ctx.response.status = 400;
      ctx.response.body = { error: "Corpo da solicitação inválido." };
      return;
    }

    // Bots tendem a preencher este campo invisível. Respondemos sem persistir.
    if (typeof body.website === "string" && body.website.trim()) {
      ctx.response.status = 202;
      ctx.response.body = { id: crypto.randomUUID() };
      return;
    }

    const name = clean(body.name, 120);
    const email = clean(body.email, 254)?.toLowerCase() ?? null;
    const subject = clean(body.subject, 160);
    const message = clean(body.message, 5000);
    const category = typeof body.category === "string" &&
        CATEGORIES.has(body.category as SupportRequestCategory)
      ? body.category as SupportRequestCategory
      : null;

    if (
      !name || !email || !EMAIL_PATTERN.test(email) || !subject || !message ||
      !category || body.privacyAccepted !== true
    ) {
      ctx.response.status = 400;
      ctx.response.body = {
        error:
          "Preencha os campos obrigatórios e aceite a Política de Privacidade.",
      };
      return;
    }

    try {
      const id = await dependencies.create({
        name,
        email,
        category,
        subject,
        message,
      });
      ctx.response.status = 201;
      ctx.response.body = { id };
    } catch (error) {
      console.error("[support] Falha ao registrar solicitação:", error);
      ctx.response.status = 503;
      ctx.response.body = {
        error:
          "Não foi possível enviar sua solicitação agora. Tente novamente em instantes.",
      };
    }
  });

  return router;
}

export default createSupportRouter();
