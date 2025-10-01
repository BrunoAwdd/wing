import { Router, Request, Response } from 'express';
import { apiLimiter } from '../middlewares/rateLimiter';
import { generateTextStream } from '../services/aiService';
import { validateLicenseToken } from '../services/licenseValidationService';
import { track } from '../services/telemetry';
import logger from '../services/logger';
import {
  PromptBuilder,
  buildFixPrompt,
  buildTranslatePrompt,
  buildSummarizePrompt,
  buildRewritePrompt,
} from '../prompts';

const router = Router();

// --- Centralized Stream Handling Logic ---

const handleStreamRequest = async (
  req: Request,
  res: Response,
  promptBuilder: PromptBuilder,
  actionName: string
) => {
  const { text, licenseToken, options } = req.body;

  if (!licenseToken) {
    track("error", { type: "auth_error", message: "Token de licença não fornecido.", route: `/api/v1/${actionName}` });
    return res.status(401).json({ error: "Token de licença não fornecido." });
  }

  const validatedLicense = await validateLicenseToken(licenseToken);
  if (!validatedLicense.isValid) {
    track("error", { type: "auth_error", message: "Licença inválida ou expirada.", route: `/api/v1/${actionName}` });
    return res.status(403).json({ error: "Licença inválida ou expirada." });
  }

  if (!text) {
    return res.status(400).json({ error: "O parâmetro 'text' é obrigatório." });
  }

  track("prompt_sent", {
    command: actionName,
    text_length: text.length,
    userId: validatedLicense.userId,
    entitlement: validatedLicense.entitlement,
  });

  const prompt = promptBuilder(text, options);

  try {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = generateTextStream(prompt, validatedLicense.entitlement);

    for await (const chunk of stream) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    logger.error({ err: error }, `Erro ao processar o stream de IA para /api/v1/${actionName}:`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    track("error", { type: "api_error", message: errorMessage, route: `/api/v1/${actionName}` });
    if (!res.writableEnded) {
      res.end();
    }
  }
};

// --- Route Definitions ---

const promptBuilderMapping: { [key: string]: PromptBuilder } = {
  fix: buildFixPrompt,
  translate: buildTranslatePrompt,
  summarize: buildSummarizePrompt,
  rewrite: buildRewritePrompt,
};

// Generate routes dynamically from the mapping
Object.entries(promptBuilderMapping).forEach(([actionName, promptBuilder]) => {
  router.post(`/${actionName}`, apiLimiter, (req, res) => 
    handleStreamRequest(req, res, promptBuilder, actionName)
  );
});

export default router;
