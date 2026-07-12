import { Router } from "../deps.ts";
import { billingService } from "../services/billingService.ts";
import { legalAnalysisService } from "../services/legalAnalysisService.ts";
import { track } from "../services/telemetry.ts";

const router = new Router();

router.post("/analyze", async (ctx) => {
  const { documentText, licenseToken } = (await ctx.request.body.json()) as {
    documentText: string;
    licenseToken: string;
  };

  if (!licenseToken) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Token de licença não fornecido." };
    return;
  }

  const validation = await billingService.validateLicenseKey(licenseToken);
  if (!validation.valid) {
    ctx.response.status = 403;
    ctx.response.body = { error: "Licença inválida ou expirada." };
    return;
  }

  if (!documentText || !documentText.trim()) {
    ctx.response.status = 400;
    ctx.response.body = { error: "O parâmetro 'documentText' é obrigatório." };
    return;
  }

  const estimatedTokens = Math.ceil(documentText.length / 4);
  if (validation.accountId) {
    billingService
      .incrementUsage(validation.accountId, estimatedTokens)
      .catch((err) => {
        console.error("[LegalRoutes] Failed to track usage:", err);
      });
  }

  track("prompt_sent", {
    command: "legal_analyze",
    text_length: documentText.length,
    userId: validation.accountId || "anonymous",
    entitlement: validation.plan || "free",
  });

  try {
    const result = await legalAnalysisService.analyze(documentText);
    ctx.response.status = 200;
    ctx.response.body = result;
  } catch (error) {
    console.error("[LegalRoutes] Analysis failed:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Falha ao analisar o documento." };
  }
});

export default router;
