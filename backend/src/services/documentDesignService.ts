import { generateStructuredJson } from "./aiService.ts";

export interface DocumentSection {
  level: 1 | 2 | 3;
  title: string;
  originalText: string;
  paragraphIndex?: number;
  detectionSource?: "word-style" | "ai" | "heuristic";
}

export interface DocumentParagraph {
  index: number;
  text: string;
  style?: string;
  styleBuiltIn?: string;
}

export interface TableCandidate {
  description: string;
  headers: string[];
  rows: string[][];
  anchorText: string;
  paragraphIndex?: number;
}

export interface ChartSuggestion {
  title: string;
  chartType: "bar" | "pie";
  labels: string[];
  values: number[];
  anchorText: string;
  paragraphIndex?: number;
  reason: string;
}

export interface VisualLawItem {
  label: string;
  text: string;
}

export interface VisualLawBlock {
  type: "summary" | "timeline" | "flow" | "obligations" | "alert";
  title: string;
  items: VisualLawItem[];
  anchorText?: string;
}

export interface VisualLawPanel {
  title: string;
  subtitle: string;
  blocks: VisualLawBlock[];
}

export interface DocumentDesignAnalysis {
  sections: DocumentSection[];
  tableCandidates: TableCandidate[];
  chartSuggestions: ChartSuggestion[];
  visualLaw: VisualLawPanel;
}

const DESIGN_SCHEMA = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          level: { type: "integer" },
          title: { type: "string" },
          originalText: { type: "string" },
          paragraphIndex: { type: "integer" },
          detectionSource: { type: "string", enum: ["word-style", "ai", "heuristic"] },
        },
        required: ["level", "title", "originalText"],
      },
    },
    tableCandidates: {
      type: "array",
      items: {
        type: "object",
        properties: {
          description: { type: "string" },
          headers: { type: "array", items: { type: "string" } },
          rows: {
            type: "array",
            items: { type: "array", items: { type: "string" } },
          },
          anchorText: { type: "string" },
          paragraphIndex: { type: "integer" },
        },
        required: ["description", "headers", "rows", "anchorText"],
      },
    },
    chartSuggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          chartType: { type: "string", enum: ["bar", "pie"] },
          labels: { type: "array", items: { type: "string" } },
          values: { type: "array", items: { type: "number" } },
          anchorText: { type: "string" },
          paragraphIndex: { type: "integer" },
          reason: { type: "string" },
        },
        required: ["title", "chartType", "labels", "values", "anchorText", "reason"],
      },
    },
    visualLaw: {
      type: "object",
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        blocks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: {
                type: "string",
                enum: ["summary", "timeline", "flow", "obligations", "alert"],
              },
              title: { type: "string" },
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    label: { type: "string" },
                    text: { type: "string" },
                  },
                  required: ["label", "text"],
                },
              },
              anchorText: { type: "string" },
            },
            required: ["type", "title", "items"],
          },
        },
      },
      required: ["title", "subtitle", "blocks"],
    },
  },
  required: ["sections", "tableCandidates", "chartSuggestions", "visualLaw"],
};

const buildDesignPrompt = (
  documentText: string,
  paragraphs: DocumentParagraph[] = []
): string => {
  const paragraphMap = paragraphs
    .filter((paragraph) => paragraph.text.trim())
    .map((paragraph) => {
      const style = paragraph.styleBuiltIn || paragraph.style || "Normal";
      return `${paragraph.index}. [${style}] ${paragraph.text.trim()}`;
    })
    .join("\n");

  return `
Você é um assistente de design de documentos. Analise a ESTRUTURA do documento a seguir (não o conteúdo jurídico/de negócio) e identifique, em português:

1. "sections": a hierarquia de títulos/seções do documento. Seja CONSERVADOR. Só marque como título uma linha isolada que já funcione como cabeçalho real no documento:
   - primeiro preserve títulos que o Word já marcou como Heading1, Heading2 ou Heading3;
   - títulos formais ("CONTRATO DE...", "CLÁUSULA PRIMEIRA - OBJETO", "1. OBJETO", "2.1 Prazo", "ANEXO I");
   - linhas curtas que introduzem uma seção clara;
   - nunca marque frase longa, trecho dentro de parágrafo, conclusão de cláusula, item de lista comum ou sentença narrativa como título.
   Para cada título, retorne nível 1 para título principal, 2 para seção/cláusula principal, 3 para subseção. "originalText" deve ser uma citação LITERAL de UMA ÚNICA LINHA do documento, palavra por palavra. Quando existir índice no mapa de parágrafos, retorne "paragraphIndex". Use "detectionSource": "word-style" quando o Word já marcou como Heading, "ai" quando você inferiu. Se tiver dúvida, deixe fora. É melhor retornar poucos títulos corretos do que muitos títulos errados.

2. "tableCandidates": blocos de texto que representam dados tabulares mas estão escritos como texto corrido ou lista (ex: uma sequência de linhas "Item: Valor", ou uma enumeração de itens com atributos repetidos). Para cada um, extraia "headers" (os nomes das colunas), "rows" (os dados já organizados em linhas/colunas), "description" (o que essa tabela representa), "anchorText" e, quando possível, "paragraphIndex" pelo mapa do Word. Só sugira isso quando os dados genuinamente parecerem tabulares — não force listas simples a virarem tabela.

3. "chartSuggestions": no MÁXIMO 3 sugestões de gráfico, e SOMENTE onde exista uma série numérica com sentido visual (valores comparáveis, proporções, contagens). Para cada sugestão: "title", "chartType" ("bar" ou "pie"), "labels" e "values" (os dados do gráfico), "anchorText", "paragraphIndex" quando possível, e "reason" (uma frase curta explicando por que um gráfico ajuda ali). Se não houver nenhuma série numérica que justifique um gráfico, retorne uma lista vazia — não invente dados.

4. "visualLaw": uma proposta pronta de Visual Law para inserir no Word como painel visual. Ela deve traduzir o documento em linguagem clara e navegável, sem alterar o sentido jurídico. Retorne:
   - "title": título curto do painel.
   - "subtitle": frase curta explicando o documento.
   - "blocks": entre 2 e 5 blocos visuais. Use "summary" para resumo executivo, "flow" para etapas/processo, "timeline" para prazos, "obligations" para deveres das partes e "alert" para riscos, exceções ou pontos de atenção.
   - cada bloco deve ter "title" e "items"; cada item deve ter "label" curto e "text" em linguagem simples.
   - use "anchorText" apenas quando o bloco estiver ligado a uma linha literal específica do documento.
   - não invente prazos, valores, riscos ou obrigações. Se algo não estiver claro, diga isso em texto simples no item.

Se o documento não tiver estrutura clara de títulos, ou não tiver dados tabulares, ou não tiver série numérica, retorne listas vazias para essas categorias — não force.
Para Visual Law, sempre retorne pelo menos um bloco "summary" quando houver texto suficiente para resumir.

--- DOCUMENTO ---
${documentText}
--- FIM DO DOCUMENTO ---

--- MAPA DE PARÁGRAFOS DO WORD ---
${paragraphMap || "(não informado)"}
--- FIM DO MAPA ---
`;
};

const normalizeText = (value: string): string =>
  value
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");

const getDocumentLines = (documentText: string): string[] =>
  documentText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

const clampSectionLevel = (level: number): 1 | 2 | 3 => {
  if (level <= 1) return 1;
  if (level === 2) return 2;
  return 3;
};

const filterSections = (
  documentText: string,
  paragraphs: DocumentParagraph[] = []
): DocumentSection[] => {
  const lines = getDocumentLines(documentText);
  const lineByNormalizedText = new Map<string, string>();
  for (const line of lines) {
    lineByNormalizedText.set(normalizeText(line), line);
  }

  const wordStyledSections = paragraphs
    .flatMap((paragraph): DocumentSection[] => {
      const style = paragraph.styleBuiltIn || paragraph.style || "";
      const match = /^Heading([1-3])$/i.exec(style.replace(/\s+/g, ""));
      if (!match || !paragraph.text.trim()) return [];
      return [{
        level: clampSectionLevel(Number(match[1])),
        title: paragraph.text.trim(),
        originalText: paragraph.text.trim(),
        paragraphIndex: paragraph.index,
        detectionSource: "word-style" as const,
      }];
    });

  const seen = new Set<string>();
  return wordStyledSections.filter((section) => {
    const key =
      typeof section.paragraphIndex === "number"
        ? `p:${section.paragraphIndex}`
        : `t:${normalizeText(section.originalText)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const attachParagraphIndexByAnchor = <
  T extends { anchorText: string; paragraphIndex?: number }
>(
  items: T[] = [],
  paragraphs: DocumentParagraph[] = []
): T[] => {
  const paragraphByText = new Map(
    paragraphs.map((paragraph) => [normalizeText(paragraph.text), paragraph])
  );

  return items.map((item) => {
    if (typeof item.paragraphIndex === "number") return item;
    const paragraph = paragraphByText.get(normalizeText(item.anchorText || ""));
    return paragraph ? { ...item, paragraphIndex: paragraph.index } : item;
  });
};

export const documentDesignService = {
  analyze: async (
    documentText: string,
    paragraphs: DocumentParagraph[] = []
  ): Promise<DocumentDesignAnalysis> => {
    const prompt = buildDesignPrompt(documentText, paragraphs);
    const rawJson = await generateStructuredJson(prompt, DESIGN_SCHEMA);
    const analysis = JSON.parse(rawJson) as DocumentDesignAnalysis;
    return {
      ...analysis,
      sections: filterSections(documentText, paragraphs),
      tableCandidates: attachParagraphIndexByAnchor(
        analysis.tableCandidates || [],
        paragraphs
      ),
      chartSuggestions: attachParagraphIndexByAnchor(
        analysis.chartSuggestions || [],
        paragraphs
      ),
    };
  },
};
