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

// --- Helper para coletar o stream da IA ---
async function collectStream(stream: AsyncGenerator<string>): Promise<string> {
  let content = '';
  for await (const chunk of stream) {
    content += chunk;
  }
  return content;
}

// --- Lógica de Rota ---

const handleStreamRequest = async (
  req: Request,
  res: Response,
  promptBuilder: PromptBuilder,
  actionName: string
) => {
  const { text: paragraphs, licenseToken, options } = req.body as { text: {id: string, text: string}[], licenseToken: string, options: any };

  if (!licenseToken) {
    return res.status(401).json({ error: "Token de licença não fornecido." });
  }

  const validatedLicense = await validateLicenseToken(licenseToken);
  if (!validatedLicense.isValid) {
    return res.status(403).json({ error: "Licença inválida ou expirada." });
  }

  if (!paragraphs || paragraphs.length === 0) {
    return res.status(400).json({ error: "O parâmetro 'text' (array de parágrafos) é obrigatório." });
  }

  track("prompt_sent", {
    command: actionName,
    text_length: paragraphs.map(p => p.text).join('\n').length,
    userId: validatedLicense.userId,
    entitlement: validatedLicense.entitlement,
  });

  const structuredPrompt = promptBuilder(JSON.stringify(paragraphs, null, 2), options);

  let fullResponse = ""; // Declarar aqui para estar acessível no catch
  try {
    // 1. Obter a resposta completa da IA
    const aiStream = generateTextStream(structuredPrompt, validatedLicense.entitlement);
    const fullResponse = await collectStream(aiStream);

    // 2. Limpar e parsear a resposta
    let cleanedJson = fullResponse.trim();
    if (cleanedJson.startsWith('```json')) {
      cleanedJson = cleanedJson.substring(7, cleanedJson.length - 3).trim();
    } else if (cleanedJson.startsWith('```')) {
      cleanedJson = cleanedJson.substring(3, cleanedJson.length - 3).trim();
    }

    // Processa cada linha como um JSON separado
    const jsonLines = cleanedJson.split('\n').filter(line => line.trim() !== '');
    const processedParagraphs = jsonLines.map(line => JSON.parse(line));

    // 3. Simular o stream para o frontend
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    for (const paragraph of processedParagraphs) {
      res.write(JSON.stringify(paragraph) + '\n');
    }
    res.end();

  } catch (error) {
    logger.error({ err: error, responseFromAI: (error as any).responseFromAI || fullResponse }, `Erro na rota /api/v1/${actionName}:`);
    const errorMessage = error instanceof Error ? error.message : String(error);
    track("error", { type: "api_error", message: errorMessage, route: `/api/v1/${actionName}` });
    if (!res.writableEnded) {
      res.status(500).json({ error: "Erro interno ao processar a solicitação de IA." });
    }
  }
};

// --- Definições de Rota ---

const promptBuilderMapping: { [key: string]: PromptBuilder } = {
  fix: buildFixPrompt,
  translate: buildTranslatePrompt,
  summarize: buildSummarizePrompt,
  rewrite: buildRewritePrompt,
};

Object.entries(promptBuilderMapping).forEach(([actionName, promptBuilder]) => {
  router.post(`/${actionName}`, apiLimiter, (req, res) => 
    handleStreamRequest(req, res, promptBuilder, actionName)
  );
});

export default router;