import { generateStructuredJson } from "./aiService.ts";

export type RiskLevel = "baixo" | "médio" | "alto";

export interface LegalParty {
  name: string;
  role: string;
}

export interface LegalClause {
  title: string;
  summary: string;
  riskLevel: RiskLevel;
  type: string;
  originalText: string;
}

export interface LegalDeadline {
  description: string;
  date: string | null;
}

export interface LegalObligation {
  party: string;
  description: string;
}

export interface LegalAnalysisResult {
  parties: LegalParty[];
  clauses: LegalClause[];
  deadlines: LegalDeadline[];
  obligations: LegalObligation[];
}

const ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    parties: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          role: { type: "string" },
        },
        required: ["name", "role"],
      },
    },
    clauses: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          summary: { type: "string" },
          riskLevel: { type: "string", enum: ["baixo", "médio", "alto"] },
          type: { type: "string" },
          originalText: { type: "string" },
        },
        required: ["title", "summary", "riskLevel", "type", "originalText"],
      },
    },
    deadlines: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          date: { type: "string", nullable: true },
        },
        required: ["description"],
      },
    },
    obligations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          party: { type: "string" },
          description: { type: "string" },
        },
        required: ["party", "description"],
      },
    },
  },
  required: ["parties", "clauses", "deadlines", "obligations"],
};

const buildAnalysisPrompt = (documentText: string): string => `
Você é um assistente jurídico especializado em "visual law" — a prática de tornar documentos legais mais compreensíveis através de estrutura visual.

Analise o documento a seguir e extraia, em português:
1. As partes envolvidas (nome e papel/função de cada uma, ex: "Contratante", "Contratada").
2. As cláusulas relevantes, cada uma com título curto, resumo em linguagem simples, nível de risco ("baixo", "médio" ou "alto" — considere risco financeiro, jurídico ou operacional para quem está lendo), tipo (ex: "rescisão", "pagamento", "confidencialidade", "responsabilidade") e "originalText": uma citação LITERAL, palavra por palavra, do trecho exato do documento correspondente a essa cláusula (copie e cole o texto real, não parafraseie — isso será usado para localizar o trecho de volta no documento).
3. Prazos e datas mencionados (descrição do que vence/acontece e a data, se houver; use null se não houver data explícita).
4. Obrigações de cada parte (quem deve fazer o quê).

Se o documento não for um contrato/instrumento jurídico, ainda assim extraia o que for aplicável e deixe listas vazias para o que não se aplicar.

--- DOCUMENTO ---
${documentText}
--- FIM DO DOCUMENTO ---
`;

export const legalAnalysisService = {
  analyze: async (documentText: string): Promise<LegalAnalysisResult> => {
    const prompt = buildAnalysisPrompt(documentText);
    const rawJson = await generateStructuredJson(prompt, ANALYSIS_SCHEMA);
    return JSON.parse(rawJson) as LegalAnalysisResult;
  },
};
