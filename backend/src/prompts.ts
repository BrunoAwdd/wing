export type PromptBuilder = (text: string, options?: { language?: string; tone?: string }) => string;

interface BasePromptOptions {
  outputLanguage?: string;
  tone?: string;
}

const basePrompt = (action: string, text: string, options: BasePromptOptions = {}) => {
  const { outputLanguage = 'o mesmo idioma do texto original', tone = 'neutro' } = options;

  return `Você é um assistente de API especialista em processamento de texto.
Sua tarefa é executar a ação solicitada no texto original.

--- REGRAS ---
1.  Sua resposta deve ser exclusivamente o texto processado. Não inclua preâmbulos, explicações, ou qualquer texto extra.
2.  O idioma da sua resposta deve ser: ${outputLanguage}.
3.  O tom da sua resposta deve ser: ${tone}.

--- AÇÃO ---
${action}

--- TEXTO ORIGINAL ---
${text}

--- TEXTO PROCESSADO ---
`;
};

export const buildFixPrompt: PromptBuilder = (text, options) =>
  basePrompt("Corrija a gramática e a ortografia do texto.", text, { tone: options?.tone || 'formal' });

export const buildTranslatePrompt: PromptBuilder = (text, options) =>
  basePrompt(`Traduza o texto.`, text, { outputLanguage: options?.language || 'Inglês' });

export const buildSummarizePrompt: PromptBuilder = (text) =>
  basePrompt("Resuma o texto de forma concisa e clara.", text);

export const buildRewritePrompt: PromptBuilder = (text, options) =>
  basePrompt(`Reescreva o texto.`, text, { tone: options?.tone || 'mais profissional' });
