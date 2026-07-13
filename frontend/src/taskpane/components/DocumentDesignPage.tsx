import * as React from "react";
import { useState, useEffect } from "react";
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
  useDocumentDesign,
  TableCandidate,
  ChartSuggestion,
} from "../hooks/useDocumentDesign";
import { THEME_PRESETS, DEFAULT_THEME, DocumentTheme, WordStyleRole } from "../../utils/themes";
import { buildBarChartSvg, svgToPngBase64 } from "../../utils/chartBuilder";
import { buildVisualLawHtml } from "../../utils/visualLawBuilder";
import { persistenceService } from "../../services/persistenceService";

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
  themeSwatches: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  swatch: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    ...shorthands.padding("6px", "10px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    cursor: "pointer",
    background: "none",
  },
  swatchSelected: {
    ...shorthands.border("2px", "solid", tokens.colorBrandStroke1),
  },
  swatchDot: {
    width: "14px",
    height: "14px",
    borderRadius: "50%",
    display: "inline-block",
  },
  colorRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "8px",
  },
  controlGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "8px",
  },
  controlField: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  fieldLabel: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  input: {
    minHeight: "30px",
    boxSizing: "border-box",
    ...shorthands.border("1px", "solid", tokens.colorNeutralStroke2),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    ...shorthands.padding("4px", "8px"),
    font: "inherit",
    backgroundColor: tokens.colorNeutralBackground1,
    color: tokens.colorNeutralForeground1,
  },
  listItem: {
    ...shorthands.padding("8px", "12px"),
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground3,
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  itemHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  levelBadge: {
    ...shorthands.padding("2px", "8px"),
    ...shorthands.borderRadius(tokens.borderRadiusCircular),
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
    backgroundColor: tokens.colorNeutralBackground5,
    whiteSpace: "nowrap",
  },
  errorText: {
    color: tokens.colorPaletteRedForeground1,
    textAlign: "center",
  },
  reasonText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    fontStyle: "italic",
  },
  footer: {
    ...shorthands.padding("16px"),
    borderTop: `1px solid ${tokens.colorNeutralStroke2}`,
    flexShrink: 0,
  },
});

interface DocumentDesignPageProps {
  onBack: () => void;
  isOnline: boolean;
  sessionToken: string | null;
  applySectionStyles: (
    sections: { level: 1 | 2 | 3; originalText: string; paragraphIndex?: number }[],
    headingColor: string
  ) => Promise<{ applied: number; notFound: number }>;
  applyDocumentTheme: (theme: DocumentTheme) => Promise<void>;
  syncDocumentTheme: (
    fallbackTheme: DocumentTheme,
    options?: { preserveThemeValues?: boolean }
  ) => Promise<DocumentTheme>;
  insertTableFromCandidate: (
    candidate: { anchorText: string; headers: string[]; rows: string[][] },
    tableStyle: string
  ) => Promise<boolean>;
  insertChartAtAnchor: (
    anchorText: string,
    base64: string,
    paragraphIndex?: number
  ) => Promise<boolean>;
  insertHtmlAtCursor: (html: string) => Promise<void>;
}

const DocumentDesignPage: React.FC<DocumentDesignPageProps> = ({
  onBack,
  isOnline,
  sessionToken,
  applySectionStyles,
  applyDocumentTheme,
  syncDocumentTheme,
  insertTableFromCandidate,
  insertChartAtAnchor,
  insertHtmlAtCursor,
}) => {
  const styles = useStyles();
  const { result, isLoading, error, analyze } = useDocumentDesign({ isOnline, sessionToken });
  const [theme, setTheme] = useState<DocumentTheme>(DEFAULT_THEME);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    persistenceService.loadTheme().then((saved) => {
      if (!saved) return;
      const currentPreset = THEME_PRESETS.find((preset) => preset.id === saved.id);
      setTheme({
        ...(currentPreset || DEFAULT_THEME),
        ...(!currentPreset ? saved : {}),
        wordStyleNames: saved.wordStyleNames,
      });
    });
  }, []);

  const selectPreset = (preset: DocumentTheme) => {
    const nextTheme: DocumentTheme = {
      ...preset,
      wordStyleNames: theme.wordStyleNames,
    };
    setTheme(nextTheme);
    persistenceService.saveTheme(nextTheme);
  };

  const handleApplyTitles = async () => {
    if (!result) return;
    setStatusMessage("Aplicando títulos e cores...");
    const { applied, notFound } = await applySectionStyles(result.sections, theme.headingColor);
    setStatusMessage(`${applied} título(s) formatado(s)${notFound > 0 ? `, ${notFound} não localizado(s)` : ""}.`);
  };

  const handleApplyDocumentTheme = async () => {
    setStatusMessage("Lendo estilos reais do Word...");
    const mappedTheme = await syncDocumentTheme(theme, { preserveThemeValues: true });
    setTheme(mappedTheme);
    await persistenceService.saveTheme(mappedTheme);
    setStatusMessage("Aplicando visual nos estilos reais do Word...");
    await applyDocumentTheme(mappedTheme);
    setStatusMessage("Estilos sincronizados aplicados ao documento.");
  };

  const handleSyncDocumentTheme = async () => {
    setStatusMessage("Sincronizando formatos do Word...");
    const syncedTheme = await syncDocumentTheme(theme);
    setTheme(syncedTheme);
    await persistenceService.saveTheme(syncedTheme);
    setStatusMessage("Formatos do Word sincronizados.");
  };

  const styleSummary = (
    role: WordStyleRole,
    label: string,
    fallbackName: string,
    fallbackFontName: string,
    fallbackFontSize: number,
    fallbackColor: string
  ) => {
    const format = theme.wordStyleFormats?.[role];
    const fontName = format?.fontName || fallbackFontName;
    const fontSize = format?.fontSize || fallbackFontSize;
    const color = format?.color || fallbackColor;
    const emphasis = [
      format?.bold ? "negrito" : null,
      format?.italic ? "italico" : null,
      format?.alignment ? `alinh. ${format.alignment}` : null,
    ].filter(Boolean);
    const spacing = [
      typeof format?.lineSpacing === "number" ? `linha ${format.lineSpacing}` : null,
      typeof format?.spaceBefore === "number" ? `antes ${format.spaceBefore}` : null,
      typeof format?.spaceAfter === "number" ? `depois ${format.spaceAfter}` : null,
    ].filter(Boolean);

    return `${label}: ${theme.wordStyleNames?.[role] || fallbackName} · ${fontName} ${fontSize}pt · ${color}${
      emphasis.length ? ` · ${emphasis.join(" · ")}` : ""
    }${spacing.length ? ` · ${spacing.join(" · ")}` : ""}`;
  };

  const handleInsertTable = async (candidate: TableCandidate) => {
    setStatusMessage("Inserindo tabela...");
    const ok = await insertTableFromCandidate(candidate, theme.tableStyle);
    setStatusMessage(ok ? "Tabela inserida no documento." : "Não foi possível inserir a tabela.");
  };

  const handleInsertChart = async (suggestion: ChartSuggestion) => {
    setStatusMessage("Gerando gráfico...");
    const svg = buildBarChartSvg(suggestion.labels, suggestion.values, theme.chartPalette, suggestion.title);
    const base64 = await svgToPngBase64(svg, 400, 260);
    const ok = await insertChartAtAnchor(
      suggestion.anchorText,
      base64,
      suggestion.paragraphIndex
    );
    setStatusMessage(ok ? "Gráfico inserido no documento." : "Não foi possível inserir o gráfico.");
  };

  const handleInsertVisualLaw = async () => {
    if (!result?.visualLaw) return;
    setStatusMessage("Inserindo painel Visual Law...");
    const html = buildVisualLawHtml(result.visualLaw, theme);
    await insertHtmlAtCursor(html);
    setStatusMessage("Painel Visual Law inserido no documento.");
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Button icon={<ArrowLeft24Regular />} appearance="transparent" onClick={onBack} />
        <Text className={styles.headerTitle}>Formatar Documento</Text>
      </div>

      <div className={styles.content}>
        <div className={styles.section}>
          <Text className={styles.sectionTitle}>Formatos do Word</Text>
          <div className={styles.themeSwatches}>
            {THEME_PRESETS.map((preset) => (
              <button
                key={preset.id}
                className={`${styles.swatch} ${theme.id === preset.id ? styles.swatchSelected : ""}`}
                onClick={() => selectPreset(preset)}
              >
                <span className={styles.swatchDot} style={{ backgroundColor: preset.accentColor }} />
                <Text>{preset.name}</Text>
              </button>
            ))}
          </div>
          <div className={styles.listItem}>
            <Text>{styleSummary("normal", "Normal", "Normal", theme.bodyFontName, theme.bodyFontSize, theme.bodyColor)}</Text>
            <Text>{styleSummary("title", "Title", "Title", theme.titleFontName || theme.headingFontName, theme.titleFontSize, theme.headingColor)}</Text>
            <Text>{styleSummary("subtitle", "Subtitle", "Subtitle", theme.subtitleFontName || theme.bodyFontName, theme.subtitleFontSize, theme.accentColor)}</Text>
            <Text>{styleSummary("heading1", "H1", "Heading 1", theme.heading1FontName || theme.headingFontName, theme.heading1FontSize, theme.headingColor)}</Text>
            <Text>{styleSummary("heading2", "H2", "Heading 2", theme.heading2FontName || theme.headingFontName, theme.heading2FontSize, theme.headingColor)}</Text>
            <Text>{styleSummary("heading3", "H3", "Heading 3", theme.heading3FontName || theme.headingFontName, theme.heading3FontSize, theme.accentColor)}</Text>
            <Text>{styleSummary("quote", "Quote", "Quote", theme.quoteFontName || theme.bodyFontName, theme.quoteFontSize, theme.quoteColor)}</Text>
          </div>
          <div className={styles.colorRow}>
            <Button appearance="primary" onClick={handleSyncDocumentTheme}>
              Sincronizar Formatos do Word
            </Button>
            <Button appearance="secondary" onClick={handleApplyDocumentTheme}>
              Aplicar Estilos Sincronizados
            </Button>
          </div>
        </div>

        {!result && !isLoading && (
          <div className={styles.centeredContainer}>
            <Text>Analise a estrutura do documento pra identificar títulos, tabelas e gráficos.</Text>
            <Button appearance="primary" onClick={analyze}>
              Analisar Estrutura do Documento
            </Button>
          </div>
        )}

        {isLoading && (
          <div className={styles.centeredContainer}>
            <Spinner />
            <Text>Analisando a estrutura do documento...</Text>
          </div>
        )}

        {error && <Text className={styles.errorText}>{error}</Text>}

        {result && (
          <>
            {result.visualLaw?.blocks?.length > 0 && (
              <div className={styles.section}>
                <div className={styles.itemHeader}>
                  <Text className={styles.sectionTitle}>Visual Law</Text>
                  <Button size="small" appearance="primary" onClick={handleInsertVisualLaw}>
                    Inserir Painel Visual Law
                  </Button>
                </div>
                <div className={styles.listItem}>
                  <strong>{result.visualLaw.title}</strong>
                  <Text className={styles.reasonText}>{result.visualLaw.subtitle}</Text>
                  <Text className={styles.reasonText}>
                    {result.visualLaw.blocks.length} bloco(s):{" "}
                    {result.visualLaw.blocks.map((block) => block.title).join(" | ")}
                  </Text>
                </div>
              </div>
            )}

            <div className={styles.section}>
              <div className={styles.itemHeader}>
                <Text className={styles.sectionTitle}>Títulos e Seções ({result.sections.length})</Text>
                {result.sections.length > 0 && (
                  <Button size="small" appearance="primary" onClick={handleApplyTitles}>
                    Aplicar Títulos e Cores
                  </Button>
                )}
              </div>
              {result.sections.map((s, i) => (
                <div key={i} className={styles.listItem}>
                  <div className={styles.itemHeader}>
                    <strong>{s.title}</strong>
                    <span className={styles.levelBadge}>H{s.level}</span>
                  </div>
                  <Text className={styles.reasonText}>
                    {typeof s.paragraphIndex === "number" ? `Parágrafo ${s.paragraphIndex + 1}` : "Localização por texto"}
                    {s.detectionSource ? ` | ${s.detectionSource}` : ""}
                  </Text>
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <Text className={styles.sectionTitle}>Candidatos a Tabela ({result.tableCandidates.length})</Text>
              {result.tableCandidates.map((c, i) => (
                <div key={i} className={styles.listItem}>
                  <div className={styles.itemHeader}>
                    <strong>{c.description}</strong>
                    <Button size="small" appearance="outline" onClick={() => handleInsertTable(c)}>
                      Inserir como Tabela
                    </Button>
                  </div>
                  <Text className={styles.reasonText}>
                    {c.headers.join(" | ")} — {c.rows.length} linha(s)
                  </Text>
                </div>
              ))}
            </div>

            <div className={styles.section}>
              <Text className={styles.sectionTitle}>Sugestões de Gráfico ({result.chartSuggestions.length})</Text>
              {result.chartSuggestions.map((s, i) => (
                <div key={i} className={styles.listItem}>
                  <div className={styles.itemHeader}>
                    <strong>{s.title}</strong>
                    <Button size="small" appearance="outline" onClick={() => handleInsertChart(s)}>
                      Inserir Gráfico
                    </Button>
                  </div>
                  <Text className={styles.reasonText}>{s.reason}</Text>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {statusMessage && (
        <div className={styles.footer}>
          <Text className={styles.reasonText}>{statusMessage}</Text>
        </div>
      )}
    </div>
  );
};

export default DocumentDesignPage;
