import { useState, useCallback } from "react";

/* global Word, process */

const BACKEND_URL = process.env.BACKEND_URL || "";

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

interface UseDocumentDesignProps {
  isOnline: boolean;
  licenseToken: string | null;
}

const getDocumentSnapshot = async (): Promise<{
  documentText: string;
  paragraphs: DocumentParagraph[];
}> => {
  return await Word.run(async (context) => {
    const body = context.document.body;
    const paragraphs = body.paragraphs;
    body.load("text");
    paragraphs.load("items/text,items/style,items/styleBuiltIn");
    await context.sync();
    return {
      documentText: body.text,
      paragraphs: paragraphs.items.map((paragraph, index) => ({
        index,
        text: paragraph.text,
        style: paragraph.style,
        styleBuiltIn: paragraph.styleBuiltIn,
      })),
    };
  });
};

export const useDocumentDesign = ({ isOnline, licenseToken }: UseDocumentDesignProps) => {
  const [result, setResult] = useState<DocumentDesignAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const analyze = useCallback(async () => {
    if (!isOnline || !licenseToken || licenseToken === "ERROR_FETCHING_TOKEN") {
      setError("Ação bloqueada. Verifique sua conexão e o status da licença.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      const { documentText, paragraphs } = await getDocumentSnapshot();
      if (!documentText.trim()) {
        throw new Error("O documento está vazio.");
      }

      const response = await fetch(`${BACKEND_URL}/api/v1/design/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText, paragraphs, licenseToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! ${response.status}`);
      }

      const data = (await response.json()) as DocumentDesignAnalysis;
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Ocorreu um erro desconhecido.");
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  }, [isOnline, licenseToken]);

  return { result, isLoading, error, analyze };
};
