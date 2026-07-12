import { useState, useEffect, useCallback, useRef } from "react";
import { LogEntry } from "../components/StatusBar";
import { DocumentTheme, WordStyleFormat, WordStyleRole } from "../../utils/themes";

/* global Word, Office */

export interface Paragraph {
  id: string;
  text: string;
}

interface WordInteractionProps {
  addLog: (message: string, type: LogEntry["type"]) => void;
}

const simpleHash = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
};

const headingStyleByLevel: Record<1 | 2 | 3, Word.BuiltInStyleName> = {
  1: Word.BuiltInStyleName.heading1,
  2: Word.BuiltInStyleName.heading2,
  3: Word.BuiltInStyleName.heading3,
};

type StyleSpec = {
  names: string[];
  fontName: string;
  fontSize: number;
  color: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: Word.Alignment | string;
  firstLineIndent?: number;
  leftIndent?: number;
  rightIndent?: number;
  lineSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  borderBottomColor?: string;
  borderBottomWidth?: string;
  borderLeftColor?: string;
  borderLeftWidth?: string;
  shadingColor?: string;
};

type SyncedStyle = {
  name?: string;
  fontName?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: Word.Alignment | string;
  lineSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  firstLineIndent?: number;
  leftIndent?: number;
  rightIndent?: number;
};

type SyncDocumentThemeOptions = {
  preserveThemeValues?: boolean;
};

const normalizeStyleName = (value: string): string =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const scoreStyleNameForRole = (styleName: string, role: string): number => {
  const normalized = normalizeStyleName(styleName);
  if (!normalized) return 0;

  if (role === "normal") {
    if (normalized === "normal") return 100;
    if (normalized.includes("normal")) return 70;
    return 0;
  }

  if (role === "title") {
    if (normalized === "title" || normalized === "titulo") return 100;
    if (/\btitulo\b/.test(normalized) && !normalized.includes("subtitulo")) return 80;
    return 0;
  }

  if (role === "subtitle") {
    if (normalized === "subtitle" || normalized === "subtitulo") return 100;
    if (normalized.includes("subtitulo")) return 85;
    return 0;
  }

  if (role === "heading1") {
    if (normalized === "heading 1" || normalized === "titulo 1") return 100;
    if (/^(1|2)\s+titulo\b/.test(normalized)) return 75;
    return 0;
  }

  if (role === "heading2") {
    if (normalized === "heading 2" || normalized === "titulo 2") return 100;
    if (/^(2|3)\s+subtitulo\b/.test(normalized)) return 75;
    return 0;
  }

  if (role === "heading3") {
    if (normalized === "heading 3" || normalized === "titulo 3") return 100;
    if (normalized.includes("versalete")) return 75;
    return 0;
  }

  if (role === "quote") {
    if (normalized === "quote" || normalized === "citacao") return 100;
    if (normalized.includes("quote") || normalized.includes("citacao")) return 85;
    return 0;
  }

  return 0;
};

const styleNameMatches = (
  styleName: string,
  roleName: string | undefined,
  role: string
): boolean => {
  if (!styleName) return false;
  if (roleName && normalizeStyleName(styleName) === normalizeStyleName(roleName)) {
    return true;
  }
  return scoreStyleNameForRole(styleName, role) >= 100;
};

const cleanString = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
};

const cleanNumber = (value: unknown): number | undefined => {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const cleanBoolean = (value: unknown): boolean | undefined => {
  return typeof value === "boolean" ? value : undefined;
};

const cleanAlignment = (value: unknown): Word.Alignment | string | undefined => {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "Mixed" || trimmed === "Unknown") return undefined;
  return trimmed;
};

const toStyleFormat = (style: SyncedStyle | null): WordStyleFormat | undefined => {
  if (!style) return undefined;
  return {
    fontName: style.fontName,
    fontSize: style.fontSize,
    color: style.color,
    bold: style.bold,
    italic: style.italic,
    alignment: cleanString(style.alignment),
    lineSpacing: style.lineSpacing,
    spaceBefore: style.spaceBefore,
    spaceAfter: style.spaceAfter,
    firstLineIndent: style.firstLineIndent,
    leftIndent: style.leftIndent,
    rightIndent: style.rightIndent,
  };
};

export const useWordInteraction = ({ addLog }: WordInteractionProps) => {
  const [originalText, setOriginalText] = useState<Paragraph[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const isUpdatingRef = useRef(isUpdating);
  isUpdatingRef.current = isUpdating;

  const handleSelectionChange = useCallback(async () => {
    if (isUpdatingRef.current) {
      addLog(`handleSelectionChange skipped due to isUpdatingRef.`, "info");
      return;
    }
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items/text");
        await context.sync();

        setOriginalText((prevOriginalText) => {
          if (paragraphs.items.length > 0 && paragraphs.items[0].text.trim() !== "") {
            const newText = paragraphs.items.map((p) => p.text).join("\n");
            const oldText = prevOriginalText.map((p) => p.text).join("\n");

            if (newText === oldText) {
              return prevOriginalText;
            }

            const paragraphData: Paragraph[] = paragraphs.items.map((p, i) => ({
              id: `${i}-${simpleHash(p.text)}`,
              text: p.text,
            }));
            addLog(`${paragraphData.length} parágrafo(s) selecionado(s).`, "info");
            return paragraphData;
          } else {
            if (prevOriginalText.length === 0) {
              return prevOriginalText;
            }
            addLog("Selecione um texto para começar.", "info");
            return [];
          }
        });
      });
    } catch (error) {
      console.error("Erro em handleSelectionChange:", error);
      addLog("Erro ao processar a seleção do texto.", "error");
    }
  }, [addLog]);

  const acceptAllSuggestions = async (paragraphsToInsert: Paragraph[]) => {
    isUpdatingRef.current = true;
    setIsUpdating(true);
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items");
        await context.sync();

        paragraphs.items.forEach((paragraph, i) => {
          if (paragraphsToInsert[i]) {
            paragraph.insertText(paragraphsToInsert[i].text, Word.InsertLocation.replace);
          }
        });

        await context.sync();
      });
      addLog("Texto atualizado com sucesso!", "success");
    } catch (error) {
      console.error("Erro em acceptAllSuggestions:", error);
      addLog("Erro ao inserir o texto sugerido.", "error");
    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
        setIsUpdating(false);
      }, 300);
    }
  };

  const acceptSingleSuggestion = async (index: number, suggestionText: string) => {
    isUpdatingRef.current = true;
    setIsUpdating(true);
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items");
        await context.sync();

        if (paragraphs.items[index]) {
          paragraphs.items[index].insertText(suggestionText, Word.InsertLocation.replace);
        }

        await context.sync();
      });
      addLog("Sugestão aceita com sucesso!", "success");
    } catch (error) {
      console.error("Erro em acceptSingleSuggestion:", error);
      addLog("Erro ao aceitar a sugestão.", "error");
    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
        setIsUpdating(false);
      }, 300);
    }
  };

  const acceptMultipleSuggestions = async (suggestions: { index: number; text: string }[]) => {
    isUpdatingRef.current = true;
    setIsUpdating(true);
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        const paragraphs = range.paragraphs;
        paragraphs.load("items");
        await context.sync();

        suggestions.forEach(({ index, text }) => {
          if (paragraphs.items[index]) {
            paragraphs.items[index].insertText(text, Word.InsertLocation.replace);
          }
        });

        await context.sync();
      });
      addLog("Sugestões aceitas com sucesso!", "success");
    } catch (error) {
      console.error("Erro em acceptMultipleSuggestions:", error);
      addLog("Erro ao aceitar as sugestões.", "error");
    } finally {
      setTimeout(() => {
        isUpdatingRef.current = false;
        setIsUpdating(false);
      }, 300);
    }
  };

  const insertAtCursor = async (textToInsert: string) => {
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        range.insertText(textToInsert, Word.InsertLocation.replace);
        await context.sync();
      });
      addLog("Texto do chat inserido no documento.", "success");
    } catch (error) {
      console.error("Erro em insertAtCursor:", error);
      addLog("Erro ao inserir o texto.", "error");
    }
  };

  const insertHtmlAtCursor = async (html: string) => {
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        range.insertHtml(html, Word.InsertLocation.replace);
        await context.sync();
      });
      addLog("HTML inserido no documento.", "success");
    } catch (error) {
      console.error("Erro em insertHtmlAtCursor:", error);
      addLog("Erro ao inserir o HTML.", "error");
    }
  };

  const highlightColorForRisk = (riskLevel: "baixo" | "médio" | "alto"): string => {
    if (riskLevel === "alto") return "Red";
    if (riskLevel === "médio") return "Yellow";
    return "BrightGreen";
  };

  const highlightClauses = async (
    clauses: { originalText: string; riskLevel: "baixo" | "médio" | "alto"; summary: string }[]
  ): Promise<{ formatted: number; notFound: number }> => {
    let formatted = 0;
    let notFound = 0;
    try {
      for (const clause of clauses) {
        await Word.run(async (context) => {
          const results = context.document.body.search(clause.originalText, {
            matchCase: false,
            ignorePunct: true,
          });
          results.load("items");
          await context.sync();

          if (results.items.length === 0) {
            notFound += 1;
            return;
          }

          const range = results.items[0];
          range.font.highlightColor = highlightColorForRisk(clause.riskLevel);
          range.insertComment(`Risco ${clause.riskLevel}: ${clause.summary}`);
          await context.sync();
          formatted += 1;
        });
      }
      addLog(
        `Cláusulas formatadas no documento: ${formatted} (${notFound} não localizadas).`,
        notFound > 0 ? "info" : "success"
      );
    } catch (error) {
      console.error("Erro em highlightClauses:", error);
      addLog("Erro ao formatar as cláusulas no documento.", "error");
    }
    return { formatted, notFound };
  };

  const beautifyTables = async (): Promise<number> => {
    let count = 0;
    try {
      await Word.run(async (context) => {
        const tables = context.document.body.tables;
        tables.load("items");
        await context.sync();

        tables.items.forEach((table) => {
          table.styleBuiltIn = Word.BuiltInStyleName.gridTable5Dark_Accent1;
          table.headerRowCount = 1;
        });

        await context.sync();
        count = tables.items.length;
      });
      addLog(`Tabelas formatadas: ${count}.`, "success");
    } catch (error) {
      console.error("Erro em beautifyTables:", error);
      addLog("Erro ao formatar as tabelas do documento.", "error");
    }
    return count;
  };

  const insertPictureAtCursor = async (base64: string) => {
    try {
      await Word.run(async (context) => {
        const range = context.document.getSelection();
        range.insertInlinePictureFromBase64(base64, Word.InsertLocation.after);
        await context.sync();
      });
      addLog("Gráfico inserido no documento.", "success");
    } catch (error) {
      console.error("Erro em insertPictureAtCursor:", error);
      addLog("Erro ao inserir o gráfico.", "error");
    }
  };

  const applySectionStyles = async (
    sections: { level: 1 | 2 | 3; originalText: string; paragraphIndex?: number }[],
    headingColor: string
  ): Promise<{ applied: number; notFound: number }> => {
    let applied = 0;
    let notFound = 0;
    try {
      for (const section of sections) {
        await Word.run(async (context) => {
          if (typeof section.paragraphIndex === "number") {
            const bodyParagraphs = context.document.body.paragraphs;
            bodyParagraphs.load("items");
            await context.sync();

            const paragraph = bodyParagraphs.items[section.paragraphIndex];
            if (paragraph) {
              paragraph.styleBuiltIn = headingStyleByLevel[section.level];
              paragraph.font.color = headingColor;
              await context.sync();
              applied += 1;
              return;
            }
          }

          const results = context.document.body.search(section.originalText, {
            matchCase: false,
            ignorePunct: true,
          });
          results.load("items");
          await context.sync();

          if (results.items.length === 0) {
            notFound += 1;
            return;
          }

          const range = results.items[0];
          const paragraphs = range.paragraphs;
          paragraphs.load("items");
          await context.sync();

          if (paragraphs.items.length > 0) {
            const paragraph = paragraphs.items[0];
            paragraph.styleBuiltIn = headingStyleByLevel[section.level];
            paragraph.font.color = headingColor;
            await context.sync();
            applied += 1;
          } else {
            notFound += 1;
          }
        });
      }
      addLog(
        `Títulos formatados: ${applied} (${notFound} não localizados).`,
        notFound > 0 ? "info" : "success"
      );
    } catch (error) {
      console.error("Erro em applySectionStyles:", error);
      addLog("Erro ao formatar os títulos do documento.", "error");
    }
    return { applied, notFound };
  };

  const applyDocumentTheme = async (theme: DocumentTheme): Promise<void> => {
    try {
      await Word.run(async (context) => {
        const styles = context.document.getStyles();
        const formatFor = (role: WordStyleRole): WordStyleFormat =>
          theme.wordStyleFormats?.[role] || {};
        const pickString = (
          role: WordStyleRole,
          key: keyof WordStyleFormat,
          fallback: string
        ): string => cleanString(formatFor(role)[key]) || fallback;
        const pickNumber = (
          role: WordStyleRole,
          key: keyof WordStyleFormat,
          fallback: number
        ): number => cleanNumber(formatFor(role)[key]) ?? fallback;
        const pickBoolean = (
          role: WordStyleRole,
          key: keyof WordStyleFormat,
          fallback: boolean
        ): boolean => cleanBoolean(formatFor(role)[key]) ?? fallback;
        const pickAlignment = (
          role: WordStyleRole,
          fallback: Word.Alignment
        ): Word.Alignment | string => cleanAlignment(formatFor(role).alignment) || fallback;
        const pickOptionalString = (
          role: WordStyleRole,
          key: keyof WordStyleFormat
        ): string | undefined => cleanString(formatFor(role)[key]);
        const supportsStyleBorders = Office.context.requirements.isSetSupported(
          "WordApiDesktop",
          "1.1"
        );
        const supportsParagraphDecor = Office.context.requirements.isSetSupported(
          "WordApiDesktop",
          "1.3"
        );
        const supportsStyleShading = Office.context.requirements.isSetSupported(
          "WordApi",
          "1.6"
        );

        const normalSpec: StyleSpec = {
            names: [theme.wordStyleNames?.normal, "Normal"].filter(Boolean) as string[],
            fontName: pickString("normal", "fontName", theme.bodyFontName),
            fontSize: pickNumber("normal", "fontSize", theme.bodyFontSize),
            color: pickString("normal", "color", theme.bodyColor),
            bold: pickBoolean("normal", "bold", false),
            italic: pickBoolean("normal", "italic", false),
            alignment: pickAlignment("normal", Word.Alignment.justified),
            firstLineIndent: pickNumber("normal", "firstLineIndent", theme.paragraphFirstLineIndent),
            leftIndent: pickNumber("normal", "leftIndent", 0),
            rightIndent: pickNumber("normal", "rightIndent", 0),
            lineSpacing: pickNumber("normal", "lineSpacing", theme.bodyLineSpacing),
            spaceBefore: 0,
            spaceAfter: pickNumber("normal", "spaceAfter", theme.paragraphSpaceAfter),
        };
        const titleSpec: StyleSpec = {
            names: [theme.wordStyleNames?.title, "Title", "Título", "Titulo"].filter(Boolean) as string[],
            fontName: pickString("title", "fontName", theme.titleFontName || theme.headingFontName),
            fontSize: pickNumber("title", "fontSize", theme.titleFontSize),
            color: pickString("title", "color", theme.headingColor),
            bold: pickBoolean("title", "bold", true),
            italic: pickBoolean("title", "italic", false),
            alignment: pickAlignment("title", Word.Alignment.left),
            firstLineIndent: pickNumber("title", "firstLineIndent", 0),
            leftIndent: pickNumber("title", "leftIndent", 0),
            rightIndent: pickNumber("title", "rightIndent", 0),
            lineSpacing: pickNumber("title", "lineSpacing", theme.titleFontSize + 4),
            spaceBefore: pickNumber("title", "spaceBefore", 0),
            spaceAfter: pickNumber("title", "spaceAfter", 10),
            borderBottomColor: pickOptionalString("title", "borderBottomColor"),
            borderBottomWidth: pickOptionalString("title", "borderBottomWidth"),
        };
        const subtitleSpec: StyleSpec = {
            names: [theme.wordStyleNames?.subtitle, "Subtitle", "Subtítulo", "Subtitulo"].filter(Boolean) as string[],
            fontName: pickString("subtitle", "fontName", theme.subtitleFontName || theme.bodyFontName),
            fontSize: pickNumber("subtitle", "fontSize", theme.subtitleFontSize),
            color: pickString("subtitle", "color", theme.accentColor),
            bold: pickBoolean("subtitle", "bold", false),
            italic: pickBoolean("subtitle", "italic", true),
            alignment: pickAlignment("subtitle", Word.Alignment.left),
            firstLineIndent: pickNumber("subtitle", "firstLineIndent", 0),
            leftIndent: pickNumber("subtitle", "leftIndent", 0),
            rightIndent: pickNumber("subtitle", "rightIndent", 0),
            lineSpacing: pickNumber("subtitle", "lineSpacing", theme.subtitleFontSize + 4),
            spaceBefore: pickNumber("subtitle", "spaceBefore", 0),
            spaceAfter: pickNumber("subtitle", "spaceAfter", 12),
        };
        const heading1Spec: StyleSpec = {
            names: [theme.wordStyleNames?.heading1, "Heading 1", "Heading1", "Título 1", "Titulo 1"].filter(Boolean) as string[],
            fontName: pickString("heading1", "fontName", theme.heading1FontName || theme.headingFontName),
            fontSize: pickNumber("heading1", "fontSize", theme.heading1FontSize),
            color: pickString("heading1", "color", theme.headingColor),
            bold: pickBoolean("heading1", "bold", true),
            italic: pickBoolean("heading1", "italic", false),
            alignment: pickAlignment("heading1", Word.Alignment.left),
            firstLineIndent: pickNumber("heading1", "firstLineIndent", 0),
            leftIndent: pickNumber("heading1", "leftIndent", 0),
            rightIndent: pickNumber("heading1", "rightIndent", 0),
            lineSpacing: pickNumber("heading1", "lineSpacing", theme.heading1FontSize + 4),
            spaceBefore: pickNumber("heading1", "spaceBefore", 14),
            spaceAfter: pickNumber("heading1", "spaceAfter", 8),
            borderBottomColor: pickOptionalString("heading1", "borderBottomColor"),
            borderBottomWidth: pickOptionalString("heading1", "borderBottomWidth"),
        };
        const heading2Spec: StyleSpec = {
            names: [theme.wordStyleNames?.heading2, "Heading 2", "Heading2", "Título 2", "Titulo 2"].filter(Boolean) as string[],
            fontName: pickString("heading2", "fontName", theme.heading2FontName || theme.headingFontName),
            fontSize: pickNumber("heading2", "fontSize", theme.heading2FontSize),
            color: pickString("heading2", "color", theme.headingColor),
            bold: pickBoolean("heading2", "bold", true),
            italic: pickBoolean("heading2", "italic", false),
            alignment: pickAlignment("heading2", Word.Alignment.left),
            firstLineIndent: pickNumber("heading2", "firstLineIndent", 0),
            leftIndent: pickNumber("heading2", "leftIndent", 0),
            rightIndent: pickNumber("heading2", "rightIndent", 0),
            lineSpacing: pickNumber("heading2", "lineSpacing", theme.heading2FontSize + 4),
            spaceBefore: pickNumber("heading2", "spaceBefore", 12),
            spaceAfter: pickNumber("heading2", "spaceAfter", 6),
            borderBottomColor: pickOptionalString("heading2", "borderBottomColor"),
            borderBottomWidth: pickOptionalString("heading2", "borderBottomWidth"),
        };
        const heading3Spec: StyleSpec = {
            names: [theme.wordStyleNames?.heading3, "Heading 3", "Heading3", "Título 3", "Titulo 3"].filter(Boolean) as string[],
            fontName: pickString("heading3", "fontName", theme.heading3FontName || theme.headingFontName),
            fontSize: pickNumber("heading3", "fontSize", theme.heading3FontSize),
            color: pickString("heading3", "color", theme.accentColor),
            bold: pickBoolean("heading3", "bold", true),
            italic: pickBoolean("heading3", "italic", false),
            alignment: pickAlignment("heading3", Word.Alignment.left),
            firstLineIndent: pickNumber("heading3", "firstLineIndent", 0),
            leftIndent: pickNumber("heading3", "leftIndent", 0),
            rightIndent: pickNumber("heading3", "rightIndent", 0),
            lineSpacing: pickNumber("heading3", "lineSpacing", theme.heading3FontSize + 4),
            spaceBefore: pickNumber("heading3", "spaceBefore", 10),
            spaceAfter: pickNumber("heading3", "spaceAfter", 4),
        };
        const quoteSpec: StyleSpec = {
            names: [theme.wordStyleNames?.quote, "Quote", "Citação", "Citacao", "Intense Quote"].filter(Boolean) as string[],
            fontName: pickString("quote", "fontName", theme.quoteFontName || theme.bodyFontName),
            fontSize: pickNumber("quote", "fontSize", theme.quoteFontSize),
            color: pickString("quote", "color", theme.quoteColor),
            bold: pickBoolean("quote", "bold", false),
            italic: pickBoolean("quote", "italic", true),
            alignment: pickAlignment("quote", Word.Alignment.justified),
            firstLineIndent: pickNumber("quote", "firstLineIndent", 0),
            leftIndent: pickNumber("quote", "leftIndent", theme.quoteLeftIndent),
            rightIndent: pickNumber("quote", "rightIndent", theme.quoteLeftIndent),
            lineSpacing: pickNumber("quote", "lineSpacing", theme.bodyLineSpacing),
            spaceBefore: pickNumber("quote", "spaceBefore", 6),
            spaceAfter: pickNumber("quote", "spaceAfter", 8),
            borderLeftColor: pickOptionalString("quote", "borderLeftColor"),
            borderLeftWidth: pickOptionalString("quote", "borderLeftWidth"),
            shadingColor: pickOptionalString("quote", "shadingColor"),
        };
        const styleSpecs: StyleSpec[] = [
          normalSpec,
          titleSpec,
          subtitleSpec,
          heading1Spec,
          heading2Spec,
          heading3Spec,
          quoteSpec,
        ];
        const applySpecToParagraph = (paragraph: Word.Paragraph, spec: StyleSpec) => {
          paragraph.font.name = spec.fontName;
          paragraph.font.size = spec.fontSize;
          paragraph.font.color = spec.color;
          paragraph.font.bold = Boolean(spec.bold);
          paragraph.font.italic = Boolean(spec.italic);
          if (spec.alignment) paragraph.alignment = spec.alignment as Word.Alignment;
          if (typeof spec.firstLineIndent === "number") {
            paragraph.firstLineIndent = spec.firstLineIndent;
          }
          if (typeof spec.leftIndent === "number") {
            paragraph.leftIndent = spec.leftIndent;
          }
          if (typeof spec.rightIndent === "number") {
            paragraph.rightIndent = spec.rightIndent;
          }
          if (typeof spec.lineSpacing === "number") {
            paragraph.lineSpacing = spec.lineSpacing;
          }
          if (typeof spec.spaceBefore === "number") {
            paragraph.spaceBefore = spec.spaceBefore;
          }
          if (typeof spec.spaceAfter === "number") {
            paragraph.spaceAfter = spec.spaceAfter;
          }
          if (supportsParagraphDecor && spec.shadingColor) {
            paragraph.shading.backgroundPatternColor = spec.shadingColor;
            paragraph.shading.texture = "Solid";
          }
        };
        const applyParagraphBorder = async (
          paragraph: Word.Paragraph,
          location: Word.BorderLocation,
          color: string | undefined,
          width: string | undefined
        ) => {
          if (!supportsParagraphDecor || !color) return;
          try {
            const borders = paragraph.borders;
            borders.load("items/location");
            await context.sync();

            const border = (borders.items as any[]).find(
              (item) => String(item.location || "") === String(location)
            ) as Word.BorderUniversal | undefined;
            if (!border) return;

            border.color = color;
            border.lineStyle = Word.BorderLineStyle.single;
            border.lineWidth = (width || "Pt025") as Word.LineWidth;
            border.isVisible = true;
          } catch (error) {
            console.warn("[Wing] Paragraph border not applied", error);
          }
        };

        for (const spec of styleSpecs) {
          for (const name of spec.names) {
            const style = styles.getByNameOrNullObject(name) as any;
            style.load("isNullObject");
            await context.sync();
            if (style.isNullObject) continue;

            style.font.name = spec.fontName;
            style.font.size = spec.fontSize;
            style.font.color = spec.color;
            style.font.bold = Boolean(spec.bold);
            style.font.italic = Boolean(spec.italic);
            if (spec.alignment) style.paragraphFormat.alignment = spec.alignment as Word.Alignment;
            if (typeof spec.firstLineIndent === "number") {
              style.paragraphFormat.firstLineIndent = spec.firstLineIndent;
            }
            if (typeof spec.leftIndent === "number") {
              style.paragraphFormat.leftIndent = spec.leftIndent;
            }
            if (typeof spec.rightIndent === "number") {
              style.paragraphFormat.rightIndent = spec.rightIndent;
            }
            if (typeof spec.lineSpacing === "number") {
              style.paragraphFormat.lineSpacing = spec.lineSpacing;
            }
            if (typeof spec.spaceBefore === "number") {
              style.paragraphFormat.spaceBefore = spec.spaceBefore;
            }
            if (typeof spec.spaceAfter === "number") {
              style.paragraphFormat.spaceAfter = spec.spaceAfter;
            }
            if (supportsStyleBorders && spec.borderBottomColor) {
              const border = style.borders.getByLocation(Word.BorderLocation.bottom);
              border.color = spec.borderBottomColor;
              border.type = Word.BorderType.single;
              border.width = (spec.borderBottomWidth || "Pt025") as Word.BorderWidth;
              border.visible = true;
            }
            if (supportsStyleBorders && spec.borderLeftColor) {
              const border = style.borders.getByLocation(Word.BorderLocation.left);
              border.color = spec.borderLeftColor;
              border.type = Word.BorderType.single;
              border.width = (spec.borderLeftWidth || "Pt025") as Word.BorderWidth;
              border.visible = true;
            }
            if (supportsStyleShading && spec.shadingColor) {
              style.shading.backgroundPatternColor = spec.shadingColor;
              style.shading.texture = "Solid";
            }
            break;
          }
        }

        const paragraphs = context.document.body.paragraphs;
        paragraphs.load("items/text,items/style,items/styleBuiltIn");
        await context.sync();

        for (const paragraph of paragraphs.items) {
          const builtInStyle = String(paragraph.styleBuiltIn || "");
          const localStyle = String(paragraph.style || "");
          if (
            builtInStyle === "Title" ||
            styleNameMatches(localStyle, theme.wordStyleNames?.title, "title")
          ) {
            applySpecToParagraph(paragraph, titleSpec);
            await applyParagraphBorder(
              paragraph,
              Word.BorderLocation.bottom,
              titleSpec.borderBottomColor,
              titleSpec.borderBottomWidth
            );
            continue;
          }

          if (
            builtInStyle === "Subtitle" ||
            styleNameMatches(localStyle, theme.wordStyleNames?.subtitle, "subtitle")
          ) {
            applySpecToParagraph(paragraph, subtitleSpec);
            continue;
          }

          const syncedHeadingLevel =
            styleNameMatches(localStyle, theme.wordStyleNames?.heading1, "heading1")
              ? 1
              : styleNameMatches(localStyle, theme.wordStyleNames?.heading2, "heading2")
                ? 2
                : styleNameMatches(localStyle, theme.wordStyleNames?.heading3, "heading3")
                  ? 3
                  : null;

          if (/^Heading[1-3]$/i.test(builtInStyle) || syncedHeadingLevel) {
            const level =
              syncedHeadingLevel ||
              (builtInStyle === "Heading1" ? 1 : builtInStyle === "Heading2" ? 2 : 3);
            const spec =
              level === 1
                ? heading1Spec
                : level === 2
                  ? heading2Spec
                  : heading3Spec;
            applySpecToParagraph(paragraph, spec);
            await applyParagraphBorder(
              paragraph,
              Word.BorderLocation.bottom,
              spec.borderBottomColor,
              spec.borderBottomWidth
            );
            continue;
          }

          if (
            builtInStyle === "Quote" ||
            builtInStyle === "IntenseQuote" ||
            styleNameMatches(localStyle, theme.wordStyleNames?.quote, "quote")
          ) {
            applySpecToParagraph(paragraph, quoteSpec);
            continue;
          }

          applySpecToParagraph(paragraph, normalSpec);
        }

        const tables = context.document.body.tables;
        tables.load("items");
        await context.sync();

        tables.items.forEach((table) => {
          table.styleBuiltIn = theme.tableStyle as Word.BuiltInStyleName;
          table.headerRowCount = 1;
        });

        await context.sync();
      });
      addLog("Tema aplicado aos estilos, corpo e tabelas do documento.", "success");
    } catch (error) {
      console.error("Erro em applyDocumentTheme:", error);
      addLog("Erro ao aplicar o tema no documento.", "error");
    }
  };

  const syncDocumentTheme = async (
    fallbackTheme: DocumentTheme,
    options: SyncDocumentThemeOptions = {}
  ): Promise<DocumentTheme> => {
    try {
      const syncedTheme = await Word.run(async (context) => {
        const styles = context.document.getStyles();
        const bodyParagraphs = context.document.body.paragraphs;
        bodyParagraphs.load(
          "items/text,items/style,items/styleBuiltIn,items/font/name,items/font/size,items/font/color,items/font/bold,items/font/italic,items/alignment,items/lineSpacing,items/spaceBefore,items/spaceAfter,items/firstLineIndent,items/leftIndent,items/rightIndent"
        );
        styles.load("items/nameLocal,items/inUse,items/quickStyle");
        await context.sync();

        const usedStyleNames = Array.from(
          new Set(
            bodyParagraphs.items
              .flatMap((paragraph) => [paragraph.style, String(paragraph.styleBuiltIn || "")])
              .map((name) => name?.trim())
              .filter((name): name is string => Boolean(name))
          )
        );

        const collectionStyleNames = (styles.items as any[])
          .filter((style: any) => style.inUse || style.quickStyle)
          .map((style: any) => style.nameLocal)
          .map((name) => cleanString(name))
          .filter((name): name is string => Boolean(name));

        const knownStyleNames = Array.from(
          new Set([...usedStyleNames, ...collectionStyleNames])
        );

        const findBestStyleNames = (role: string, fallbacks: string[]): string[] => {
          const scored = knownStyleNames
            .map((name) => ({ name, score: scoreStyleNameForRole(name, role) }))
            .filter((item) => item.score > 0)
            .sort((a, b) => b.score - a.score)
            .map((item) => item.name);

          return Array.from(new Set([...scored, ...fallbacks]));
        };

        const paragraphSampleByRole = (role: string): SyncedStyle | null => {
          let best:
            | { score: number; sample: SyncedStyle }
            | null = null;

          for (const paragraph of bodyParagraphs.items as any[]) {
            const localStyle = String(paragraph.style || "");
            const builtInStyle = String(paragraph.styleBuiltIn || "");
            const score = Math.max(
              scoreStyleNameForRole(localStyle, role),
              scoreStyleNameForRole(builtInStyle, role)
            );

            if (score === 0) continue;

            const sample: SyncedStyle = {
              name: cleanString(localStyle) || cleanString(builtInStyle),
              fontName: cleanString(paragraph.font?.name),
              fontSize: cleanNumber(paragraph.font?.size),
              color: cleanString(paragraph.font?.color),
              bold: cleanBoolean(paragraph.font?.bold),
              italic: cleanBoolean(paragraph.font?.italic),
              alignment: cleanAlignment(paragraph.alignment),
              lineSpacing: cleanNumber(paragraph.lineSpacing),
              spaceBefore: cleanNumber(paragraph.spaceBefore),
              spaceAfter: cleanNumber(paragraph.spaceAfter),
              firstLineIndent: cleanNumber(paragraph.firstLineIndent),
              leftIndent: cleanNumber(paragraph.leftIndent),
              rightIndent: cleanNumber(paragraph.rightIndent),
            };

            if (!best || score > best.score) {
              best = { score, sample };
            }
          }

          return best?.sample || null;
        };

        const readLoadedStyle = async (style: any, displayName: string): Promise<SyncedStyle> => {
          style.font.load("name,size,color,bold,italic");
          style.paragraphFormat.load(
            "alignment,lineSpacing,spaceBefore,spaceAfter,firstLineIndent,leftIndent,rightIndent"
          );
          await context.sync();

          return {
            name: displayName,
            fontName: cleanString(style.font.name),
            fontSize: cleanNumber(style.font.size),
            color: cleanString(style.font.color),
            bold: cleanBoolean(style.font.bold),
            italic: cleanBoolean(style.font.italic),
            alignment: cleanAlignment(style.paragraphFormat.alignment),
            lineSpacing: cleanNumber(style.paragraphFormat.lineSpacing),
            spaceBefore: cleanNumber(style.paragraphFormat.spaceBefore),
            spaceAfter: cleanNumber(style.paragraphFormat.spaceAfter),
            firstLineIndent: cleanNumber(style.paragraphFormat.firstLineIndent),
            leftIndent: cleanNumber(style.paragraphFormat.leftIndent),
            rightIndent: cleanNumber(style.paragraphFormat.rightIndent),
          };
        };

        const readStyle = async (names: string[]): Promise<SyncedStyle | null> => {
          const loadedStyles = styles.items as any[];
          for (const name of names) {
            const normalizedName = normalizeStyleName(name);
            const loadedStyle = loadedStyles.find((style: any) => {
              const local = cleanString(style.nameLocal);
              return local && normalizeStyleName(local) === normalizedName;
            });

            if (loadedStyle) {
              return readLoadedStyle(
                loadedStyle,
                cleanString(loadedStyle.nameLocal) || name
              );
            }

            const style = styles.getByNameOrNullObject(name) as any;
            style.load("isNullObject");
            await context.sync();
            if (style.isNullObject) continue;

            return readLoadedStyle(style, name);
          }
          return null;
        };

        const normal = await readStyle(findBestStyleNames("normal", ["Normal"]));
        const title = await readStyle(
          findBestStyleNames("title", ["Title", "Título", "Titulo"])
        );
        const subtitle = await readStyle(
          findBestStyleNames("subtitle", ["Subtitle", "Subtítulo", "Subtitulo"])
        );
        const heading1 = await readStyle(
          findBestStyleNames("heading1", ["Heading 1", "Heading1", "Título 1", "Titulo 1"])
        );
        const heading2 = await readStyle(
          findBestStyleNames("heading2", ["Heading 2", "Heading2", "Título 2", "Titulo 2"])
        );
        const heading3 = await readStyle(
          findBestStyleNames("heading3", ["Heading 3", "Heading3", "Título 3", "Titulo 3"])
        );
        const quote = await readStyle(
          findBestStyleNames("quote", ["Quote", "Citação", "Citacao", "Intense Quote"])
        );
        const normalSample = paragraphSampleByRole("normal");
        const titleSample = paragraphSampleByRole("title");
        const subtitleSample = paragraphSampleByRole("subtitle");
        const heading1Sample = paragraphSampleByRole("heading1");
        const heading2Sample = paragraphSampleByRole("heading2");
        const heading3Sample = paragraphSampleByRole("heading3");
        const quoteSample = paragraphSampleByRole("quote");

        const resolvedNormal = normalSample || normal;
        const resolvedTitle = titleSample || title;
        const resolvedSubtitle = subtitleSample || subtitle;
        const resolvedHeading1 = heading1Sample || heading1;
        const resolvedHeading2 = heading2Sample || heading2;
        const resolvedHeading3 = heading3Sample || heading3;
        const resolvedQuote = quoteSample || quote;

        console.info("[Wing] Synced Word styles", {
          normal: resolvedNormal?.name,
          title: resolvedTitle?.name,
          subtitle: resolvedSubtitle?.name,
          heading1: resolvedHeading1?.name,
          heading2: resolvedHeading2?.name,
          heading3: resolvedHeading3?.name,
          quote: resolvedQuote?.name,
          source: {
            normal: normalSample ? "paragraph" : "style",
            title: titleSample ? "paragraph" : "style",
            subtitle: subtitleSample ? "paragraph" : "style",
            heading1: heading1Sample ? "paragraph" : "style",
            heading2: heading2Sample ? "paragraph" : "style",
            heading3: heading3Sample ? "paragraph" : "style",
            quote: quoteSample ? "paragraph" : "style",
          },
        });

        const mergeSyncedFormat = (
          role: WordStyleRole,
          style: SyncedStyle | null
        ): WordStyleFormat | undefined => {
          const syncedFormat = toStyleFormat(style);
          const existingFormat = fallbackTheme.wordStyleFormats?.[role];
          if (!syncedFormat && !existingFormat) return undefined;
          return {
            ...existingFormat,
            ...syncedFormat,
          };
        };

        const mappedTheme: DocumentTheme = {
          ...fallbackTheme,
          wordStyleNames: {
            ...fallbackTheme.wordStyleNames,
            normal: resolvedNormal?.name || fallbackTheme.wordStyleNames?.normal,
            title: resolvedTitle?.name || fallbackTheme.wordStyleNames?.title,
            subtitle: resolvedSubtitle?.name || fallbackTheme.wordStyleNames?.subtitle,
            heading1: resolvedHeading1?.name || fallbackTheme.wordStyleNames?.heading1,
            heading2: resolvedHeading2?.name || fallbackTheme.wordStyleNames?.heading2,
            heading3: resolvedHeading3?.name || fallbackTheme.wordStyleNames?.heading3,
            quote: resolvedQuote?.name || fallbackTheme.wordStyleNames?.quote,
          },
        };

        if (options.preserveThemeValues) {
          return mappedTheme;
        }

        return {
          ...mappedTheme,
          wordStyleFormats: {
            ...fallbackTheme.wordStyleFormats,
            normal: mergeSyncedFormat("normal", resolvedNormal),
            title: mergeSyncedFormat("title", resolvedTitle),
            subtitle: mergeSyncedFormat("subtitle", resolvedSubtitle),
            heading1: mergeSyncedFormat("heading1", resolvedHeading1),
            heading2: mergeSyncedFormat("heading2", resolvedHeading2),
            heading3: mergeSyncedFormat("heading3", resolvedHeading3),
            quote: mergeSyncedFormat("quote", resolvedQuote),
          },
          bodyFontName: resolvedNormal?.fontName || fallbackTheme.bodyFontName,
          bodyFontSize: resolvedNormal?.fontSize || fallbackTheme.bodyFontSize,
          bodyColor: resolvedNormal?.color || fallbackTheme.bodyColor,
          bodyLineSpacing: resolvedNormal?.lineSpacing || fallbackTheme.bodyLineSpacing,
          paragraphSpaceAfter: resolvedNormal?.spaceAfter ?? fallbackTheme.paragraphSpaceAfter,
          paragraphFirstLineIndent:
            resolvedNormal?.firstLineIndent ?? fallbackTheme.paragraphFirstLineIndent,
          headingFontName:
            resolvedHeading1?.fontName ||
            resolvedTitle?.fontName ||
            fallbackTheme.headingFontName,
          titleFontName:
            resolvedTitle?.fontName ||
            fallbackTheme.titleFontName ||
            fallbackTheme.headingFontName,
          subtitleFontName:
            resolvedSubtitle?.fontName ||
            fallbackTheme.subtitleFontName ||
            fallbackTheme.bodyFontName,
          heading1FontName:
            resolvedHeading1?.fontName ||
            fallbackTheme.heading1FontName ||
            fallbackTheme.headingFontName,
          heading2FontName:
            resolvedHeading2?.fontName ||
            fallbackTheme.heading2FontName ||
            fallbackTheme.headingFontName,
          heading3FontName:
            resolvedHeading3?.fontName ||
            fallbackTheme.heading3FontName ||
            fallbackTheme.headingFontName,
          headingColor:
            resolvedHeading1?.color ||
            resolvedTitle?.color ||
            fallbackTheme.headingColor,
          accentColor:
            resolvedHeading3?.color ||
            resolvedSubtitle?.color ||
            fallbackTheme.accentColor,
          titleFontSize: resolvedTitle?.fontSize || fallbackTheme.titleFontSize,
          subtitleFontSize: resolvedSubtitle?.fontSize || fallbackTheme.subtitleFontSize,
          heading1FontSize: resolvedHeading1?.fontSize || fallbackTheme.heading1FontSize,
          heading2FontSize: resolvedHeading2?.fontSize || fallbackTheme.heading2FontSize,
          heading3FontSize: resolvedHeading3?.fontSize || fallbackTheme.heading3FontSize,
          quoteColor: resolvedQuote?.color || fallbackTheme.quoteColor,
          quoteFontName:
            resolvedQuote?.fontName ||
            fallbackTheme.quoteFontName ||
            fallbackTheme.bodyFontName,
          quoteFontSize: resolvedQuote?.fontSize || fallbackTheme.quoteFontSize,
          quoteLeftIndent: resolvedQuote?.leftIndent ?? fallbackTheme.quoteLeftIndent,
        };
      });

      addLog(
        options.preserveThemeValues
          ? "Estilos reais do Word mapeados antes da aplicação."
          : "Formatos do Word sincronizados com o Wing.",
        "success"
      );
      return syncedTheme;
    } catch (error) {
      console.error("Erro em syncDocumentTheme:", error);
      addLog("Erro ao sincronizar os formatos do Word.", "error");
      return fallbackTheme;
    }
  };

  const insertTableFromCandidate = async (
    candidate: { anchorText: string; headers: string[]; rows: string[][]; paragraphIndex?: number },
    tableStyle: string
  ): Promise<boolean> => {
    try {
      let inserted = false;
      await Word.run(async (context) => {
        const values = [candidate.headers, ...candidate.rows];
        if (typeof candidate.paragraphIndex === "number") {
          const paragraphs = context.document.body.paragraphs;
          paragraphs.load("items");
          await context.sync();

          const paragraph = paragraphs.items[candidate.paragraphIndex];
          if (paragraph) {
            const table = paragraph.insertTable(
              values.length,
              candidate.headers.length,
              Word.InsertLocation.after,
              values
            );
            table.styleBuiltIn = tableStyle as Word.BuiltInStyleName;
            table.headerRowCount = 1;
            await context.sync();
            inserted = true;
            return;
          }
        }

        const results = context.document.body.search(candidate.anchorText, {
          matchCase: false,
          ignorePunct: true,
        });
        results.load("items");
        await context.sync();

        if (results.items.length === 0) {
          addLog("Trecho âncora não encontrado; tabela não inserida.", "error");
          return;
        }

        const anchor = results.items[0];
        const table = anchor.insertTable(
          values.length,
          candidate.headers.length,
          Word.InsertLocation.after,
          values
        );
        table.styleBuiltIn = tableStyle as Word.BuiltInStyleName;
        table.headerRowCount = 1;
        await context.sync();
        inserted = true;
      });
      addLog(inserted ? "Tabela inserida no documento." : "Não foi possível inserir a tabela.", inserted ? "success" : "error");
      return inserted;
    } catch (error) {
      console.error("Erro em insertTableFromCandidate:", error);
      addLog("Erro ao inserir a tabela.", "error");
      return false;
    }
  };

  const insertChartAtAnchor = async (
    anchorText: string,
    base64: string,
    paragraphIndex?: number
  ): Promise<boolean> => {
    try {
      let inserted = false;
      await Word.run(async (context) => {
        if (typeof paragraphIndex === "number") {
          const paragraphs = context.document.body.paragraphs;
          paragraphs.load("items");
          await context.sync();

          const paragraph = paragraphs.items[paragraphIndex];
          if (paragraph) {
            paragraph.insertInlinePictureFromBase64(base64, Word.InsertLocation.end);
            await context.sync();
            inserted = true;
            return;
          }
        }

        const results = context.document.body.search(anchorText, {
          matchCase: false,
          ignorePunct: true,
        });
        results.load("items");
        await context.sync();

        if (results.items.length === 0) {
          addLog("Trecho âncora não encontrado; gráfico não inserido.", "error");
          return;
        }

        const anchor = results.items[0];
        anchor.insertInlinePictureFromBase64(base64, Word.InsertLocation.after);
        await context.sync();
        inserted = true;
      });
      addLog(inserted ? "Gráfico inserido no documento." : "Não foi possível inserir o gráfico.", inserted ? "success" : "error");
      return inserted;
    } catch (error) {
      console.error("Erro em insertChartAtAnchor:", error);
      addLog("Erro ao inserir o gráfico.", "error");
      return false;
    }
  };

  useEffect(() => {
    Office.context.document.addHandlerAsync(
      Office.EventType.DocumentSelectionChanged,
      handleSelectionChange,
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          console.error("Falha ao registrar o handler de seleção: " + result.error.message);
        }
      }
    );
    handleSelectionChange();
  }, [handleSelectionChange]);

  return {
    originalText,
    acceptAllSuggestions,
    acceptSingleSuggestion,
    acceptMultipleSuggestions,
    insertAtCursor,
    insertHtmlAtCursor,
    highlightClauses,
    beautifyTables,
    insertPictureAtCursor,
    applySectionStyles,
    applyDocumentTheme,
    syncDocumentTheme,
    insertTableFromCandidate,
    insertChartAtAnchor,
    isUpdating,
  };
};
