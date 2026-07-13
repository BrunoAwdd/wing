import * as React from "react";
import ReactDOMServer from "react-dom/server";
import {
  makeStyles,
  tokens,
  Button,
  Text,
  shorthands,
  Spinner,
} from "@fluentui/react-components";
import { ArrowLeft24Regular } from "@fluentui/react-icons";
import {
  useLegalAnalysis,
  LegalClause,
  LegalAnalysisResult,
  RiskLevel,
} from "../hooks/useLegalAnalysis";
import { buildRiskDistributionSvg, svgToPngBase64 } from "../../utils/riskChart";

const useStyles = makeStyles({
  root: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    boxSizing: "border-box",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    display: "flex",
    alignItems: "center",
    ...shorthands.padding("8px"),
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: tokens.fontSizeBase500,
    fontWeight: tokens.fontWeightSemibold,
    marginLeft: "8px",
  },
  content: {
    flexGrow: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    ...shorthands.gap("16px"),
    ...shorthands.padding("16px"),
  },
  centeredContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "16px",
    height: "100%",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sectionTitle: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase400,
  },
  clauseCard: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    ...shorthands.padding("12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground3,
  },
  clauseHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  riskChip: {
    ...shorthands.padding("2px", "8px"),
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    whiteSpace: "nowrap",
  },
  riskAlto: {
    backgroundColor: tokens.colorPaletteRedBackground2,
    color: tokens.colorPaletteRedForeground1,
  },
  riskMedio: {
    backgroundColor: tokens.colorPaletteYellowBackground2,
    color: tokens.colorPaletteYellowForeground1,
  },
  riskBaixo: {
    backgroundColor: tokens.colorPaletteLightGreenBackground2,
    color: tokens.colorPaletteLightGreenForeground1,
  },
  listItem: {
    ...shorthands.padding("8px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground3,
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    textAlign: "center",
  },
  footer: {
    display: "flex",
    flexWrap: "wrap",
    ...shorthands.gap("8px"),
    ...shorthands.padding("16px"),
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
  statusText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
});

const riskStyleKey = (risk: RiskLevel): "riskAlto" | "riskMedio" | "riskBaixo" => {
  if (risk === "alto") return "riskAlto";
  if (risk === "médio") return "riskMedio";
  return "riskBaixo";
};

interface RiskChipProps {
  risk: RiskLevel;
}

const RiskChip: React.FC<RiskChipProps> = ({ risk }) => {
  const styles = useStyles();
  return <span className={`${styles.riskChip} ${styles[riskStyleKey(risk)]}`}>{risk}</span>;
};

const buildSummaryMarkup = (result: LegalAnalysisResult): React.ReactElement => (
  <div>
    <h2>Resumo da Análise Jurídica</h2>
    <h3>Partes</h3>
    <ul>
      {result.parties.map((p, i) => (
        <li key={i}>
          <strong>{p.name}</strong> — {p.role}
        </li>
      ))}
    </ul>
    <h3>Cláusulas</h3>
    <ul>
      {result.clauses.map((c: LegalClause, i) => (
        <li key={i}>
          <strong>
            {c.title} [{c.riskLevel}]
          </strong>
          : {c.summary}
        </li>
      ))}
    </ul>
    <h3>Prazos</h3>
    <ul>
      {result.deadlines.map((d, i) => (
        <li key={i}>
          {d.description}
          {d.date ? ` — ${d.date}` : ""}
        </li>
      ))}
    </ul>
    <h3>Obrigações</h3>
    <ul>
      {result.obligations.map((o, i) => (
        <li key={i}>
          <strong>{o.party}</strong>: {o.description}
        </li>
      ))}
    </ul>
  </div>
);

interface LegalAnalysisPageProps {
  onBack: () => void;
  insertHtmlAtCursor: (html: string) => Promise<void>;
  isOnline: boolean;
  sessionToken: string | null;
  highlightClauses: (
    clauses: { originalText: string; riskLevel: RiskLevel; summary: string }[]
  ) => Promise<{ formatted: number; notFound: number }>;
  beautifyTables: () => Promise<number>;
  insertPictureAtCursor: (base64: string) => Promise<void>;
}

const LegalAnalysisPage: React.FC<LegalAnalysisPageProps> = ({
  onBack,
  insertHtmlAtCursor,
  isOnline,
  sessionToken,
  highlightClauses,
  beautifyTables,
  insertPictureAtCursor,
}) => {
  const styles = useStyles();
  const { result, isLoading, error, analyze } = useLegalAnalysis({ isOnline, sessionToken });
  const [actionStatus, setActionStatus] = React.useState<string | null>(null);

  const handleInsert = () => {
    if (!result) return;
    const html = ReactDOMServer.renderToStaticMarkup(buildSummaryMarkup(result));
    insertHtmlAtCursor(html);
  };

  const handleFormatClauses = async () => {
    if (!result) return;
    setActionStatus("Formatando cláusulas no documento...");
    const { formatted, notFound } = await highlightClauses(result.clauses);
    setActionStatus(`${formatted} cláusula(s) formatada(s)${notFound > 0 ? `, ${notFound} não localizada(s)` : ""}.`);
  };

  const handleBeautifyTables = async () => {
    setActionStatus("Formatando tabelas do documento...");
    const count = await beautifyTables();
    setActionStatus(count > 0 ? `${count} tabela(s) formatada(s).` : "Nenhuma tabela encontrada no documento.");
  };

  const handleInsertChart = async () => {
    if (!result) return;
    setActionStatus("Gerando gráfico de risco...");
    const svg = buildRiskDistributionSvg(result.clauses);
    const base64 = await svgToPngBase64(svg, 400, 260);
    await insertPictureAtCursor(base64);
    setActionStatus("Gráfico inserido no documento.");
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button icon={<ArrowLeft24Regular />} appearance="transparent" onClick={onBack} />
        <Text className={styles.headerTitle}>Análise Jurídica</Text>
      </div>

      <div className={styles.content}>
        {!result && !isLoading && (
          <div className={styles.centeredContainer}>
            <Text>Analise o contrato/documento aberto para extrair partes, cláusulas, prazos e obrigações.</Text>
            <Button appearance="primary" onClick={analyze}>
              Analisar Contrato
            </Button>
          </div>
        )}

        {isLoading && (
          <div className={styles.centeredContainer}>
            <Spinner />
            <Text>Analisando o documento...</Text>
          </div>
        )}

        {error && <Text className={styles.errorText}>{error}</Text>}

        {result && (
          <>
            <div className={styles.section}>
              <Text className={styles.sectionTitle}>Partes</Text>
              {result.parties.map((p, i) => (
                <div key={i} className={styles.listItem}>
                  <strong>{p.name}</strong> — {p.role}
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <Text className={styles.sectionTitle}>Cláusulas</Text>
              {result.clauses.map((c, i) => (
                <div key={i} className={styles.clauseCard}>
                  <div className={styles.clauseHeader}>
                    <strong>{c.title}</strong>
                    <RiskChip risk={c.riskLevel} />
                  </div>
                  <Text>{c.summary}</Text>
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <Text className={styles.sectionTitle}>Prazos</Text>
              {result.deadlines.map((d, i) => (
                <div key={i} className={styles.listItem}>
                  {d.description}
                  {d.date ? ` — ${d.date}` : ""}
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <Text className={styles.sectionTitle}>Obrigações</Text>
              {result.obligations.map((o, i) => (
                <div key={i} className={styles.listItem}>
                  <strong>{o.party}</strong>: {o.description}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div className={styles.footer}>
        {result && (
          <>
            <Button appearance="primary" onClick={handleInsert}>
              Inserir no Documento
            </Button>
            <Button appearance="outline" onClick={handleFormatClauses}>
              Formatar Cláusulas no Documento
            </Button>
            <Button appearance="outline" onClick={handleInsertChart}>
              Inserir Gráfico de Risco
            </Button>
          </>
        )}
        <Button appearance="outline" onClick={handleBeautifyTables}>
          Embelezar Tabelas
        </Button>
        {actionStatus && <Text className={styles.statusText}>{actionStatus}</Text>}
      </div>
    </div>
  );
};

export default LegalAnalysisPage;
