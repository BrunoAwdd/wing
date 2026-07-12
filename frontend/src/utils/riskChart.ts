import { LegalClause } from "../taskpane/hooks/useLegalAnalysis";
import { buildBarChartSvg } from "./chartBuilder";

export { svgToPngBase64 } from "./chartBuilder";

const RISK_COLORS: Record<string, string> = {
  alto: "#D13438",
  médio: "#EAA300",
  baixo: "#107C10",
};

const RISK_ORDER: Array<"alto" | "médio" | "baixo"> = ["alto", "médio", "baixo"];

export const buildRiskDistributionSvg = (clauses: LegalClause[]): string => {
  const counts: Record<string, number> = { alto: 0, médio: 0, baixo: 0 };
  clauses.forEach((c) => {
    counts[c.riskLevel] = (counts[c.riskLevel] || 0) + 1;
  });

  const values = RISK_ORDER.map((r) => counts[r]);
  const colors = RISK_ORDER.map((r) => RISK_COLORS[r]);

  return buildBarChartSvg(RISK_ORDER, values, colors, "Distribuição de Risco das Cláusulas");
};
