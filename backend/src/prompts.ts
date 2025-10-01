export type PromptBuilder = (jsonString: string, options?: { language?: string; tone?: string }) => string;

interface BasePromptOptions {
  outputLanguage?: string;
  tone?: string;
}

const basePrompt = (action: string, jsonString: string, options: BasePromptOptions = {}) => {
  const { outputLanguage = 'o mesmo idioma do texto original', tone = 'neutro' } = options;

  return `Você é um serviço de API para processamento de texto.

--- ENTRADA ---
Você receberá um JSON contendo um array de objetos. Cada objeto representa um parágrafo e tem a estrutura: { "id": string, "text": string }.

--- TAREFA ---
1.  Para cada parágrafo no array de entrada, execute a seguinte ação no seu texto: "${action}".
2.  O idioma do texto resultante deve ser: ${outputLanguage}.
3.  O tom do texto resultante deve ser: ${tone}.

--- SAÍDA ---
Sua resposta DEVE ser um stream de dados. Cada dado no stream precisa ser um objeto JSON completo, representando um parágrafo processado.
Cada objeto JSON deve ter a mesma estrutura do objeto de entrada: { "id": string, "text": string }, contendo o ID original e o texto modificado.
Após cada objeto JSON, você DEVE inserir um caractere de quebra de linha (\n).

NÃO inclua nenhuma explicação ou texto extra na sua resposta. A resposta deve ser SOMENTE o stream de objetos JSON, um por linha.

--- JSON DE ENTRADA ---
${jsonString}

--- STREAM DE SAÍDA (JSON um por linha) ---
`;
};

export const buildFixPrompt: PromptBuilder = (text, options) =>
  basePrompt("Corrija a gramática e a ortografia do texto.", text, { tone: options?.tone || 'formal' });

export const buildTranslatePrompt: PromptBuilder = (text, options) =>
  basePrompt(`Traduza o texto.`, text, { outputLanguage: options?.language || 'Inglês' });

export const buildSummarizePrompt: PromptBuilder = (text) =>
  basePrompt("Resuma o texto de forma concisa e clara. Se houver múltiplos parágrafos, resuma cada um individualmente.", text);

export const buildRewritePrompt: PromptBuilder = (text, options) =>
  basePrompt(`Reescreva o texto.`, text, { tone: options?.tone || 'mais profissional' });
