import { Router } from "../deps.ts";
import { billingService } from "../services/billingService.ts";
import {
  documentDesignService,
  DocumentParagraph,
} from "../services/documentDesignService.ts";
import { track } from "../services/telemetry.ts";
import {
  getWingAuth,
  requireWingSession,
} from "../middlewares/authMiddleware.ts";

const router = new Router();
router.use(requireWingSession);

router.post("/analyze", async (ctx) => {
  const { documentText, paragraphs = [] } = (await ctx.request.body.json()) as {
    documentText: string;
    paragraphs?: DocumentParagraph[];
  };
  const auth = getWingAuth(ctx);

  if (!documentText || !documentText.trim()) {
    ctx.response.status = 400;
    ctx.response.body = { error: "O parâmetro 'documentText' é obrigatório." };
    return;
  }

  const entitlement = await billingService.getEntitlement(auth.accountId);
  const estimatedTokens = Math.ceil(documentText.length / 4);
  billingService.incrementUsage(auth.accountId, estimatedTokens).catch(
    (err) => {
      console.error("[DesignRoutes] Failed to track usage:", err);
    },
  );

  track(
    "prompt_sent",
    {
      command: "design_analyze",
      text_length: documentText.length,
      entitlement: entitlement.plan,
    },
    auth.accountId,
  );

  try {
    const result = await documentDesignService.analyze(
      documentText,
      paragraphs,
    );
    ctx.response.status = 200;
    ctx.response.body = result;
  } catch (error) {
    console.error("[DesignRoutes] Analysis failed:", error);
    ctx.response.status = 500;
    ctx.response.body = {
      error: "Falha ao analisar a estrutura do documento.",
    };
  }
});

export default router;
