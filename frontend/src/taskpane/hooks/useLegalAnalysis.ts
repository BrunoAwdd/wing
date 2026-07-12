import { useState, useCallback } from "react";

/* global Word, process */

const BACKEND_URL = process.env.BACKEND_URL || "";

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

interface UseLegalAnalysisProps {
  isOnline: boolean;
  licenseToken: string | null;
}

const getDocumentAsText = async (): Promise<string> => {
  return await Word.run(async (context) => {
    const body = context.document.body;
    body.load("text");
    await context.sync();
    return body.text;
  });
};

export const useLegalAnalysis = ({ isOnline, licenseToken }: UseLegalAnalysisProps) => {
  const [result, setResult] = useState<LegalAnalysisResult | null>(null);
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
      const documentText = await getDocumentAsText();
      if (!documentText.trim()) {
        throw new Error("O documento está vazio.");
      }

      const response = await fetch(`${BACKEND_URL}/api/v1/legal/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentText, licenseToken }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! ${response.status}`);
      }

      const data = (await response.json()) as LegalAnalysisResult;
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
