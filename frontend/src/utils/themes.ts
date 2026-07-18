export type WordStyleRole =
  "normal" | "title" | "subtitle" | "heading1" | "heading2" | "heading3" | "quote";

export interface WordStyleFormat {
  fontName?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  alignment?: string;
  lineSpacing?: number;
  spaceBefore?: number;
  spaceAfter?: number;
  firstLineIndent?: number;
  leftIndent?: number;
  rightIndent?: number;
  borderBottomColor?: string;
  borderBottomWidth?: string;
  borderLeftColor?: string;
  borderLeftWidth?: string;
  shadingColor?: string;
}

export interface DocumentTheme {
  id: string;
  name: string;
  headingColor: string;
  accentColor: string;
  bodyColor: string;
  bodyFontName: string;
  bodyFontSize: number;
  bodyLineSpacing: number;
  paragraphSpaceAfter: number;
  paragraphFirstLineIndent: number;
  headingFontName: string;
  titleFontName?: string;
  subtitleFontName?: string;
  heading1FontName?: string;
  heading2FontName?: string;
  heading3FontName?: string;
  titleFontSize: number;
  subtitleFontSize: number;
  heading1FontSize: number;
  heading2FontSize: number;
  heading3FontSize: number;
  quoteColor: string;
  quoteFontName?: string;
  quoteFontSize: number;
  quoteLeftIndent: number;
  tableStyle: string;
  chartPalette: string[];
  wordStyleNames?: {
    normal?: string;
    title?: string;
    subtitle?: string;
    heading1?: string;
    heading2?: string;
    heading3?: string;
    quote?: string;
  };
  wordStyleFormats?: Partial<Record<WordStyleRole, WordStyleFormat>>;
}

const visualLawPremiumFormats: Partial<Record<WordStyleRole, WordStyleFormat>> = {
  normal: {
    fontName: "Aptos",
    fontSize: 11,
    color: "#242424",
    bold: false,
    italic: false,
    alignment: "Justified",
    lineSpacing: 16.2,
    spaceBefore: 0,
    spaceAfter: 4,
    firstLineIndent: 18,
    leftIndent: 0,
    rightIndent: 0,
  },
  title: {
    fontName: "Aptos Display",
    fontSize: 18.5,
    color: "#1F2937",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 22,
    spaceBefore: 0,
    spaceAfter: 8,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#D8C89A",
    borderBottomWidth: "Pt050",
  },
  subtitle: {
    fontName: "Aptos",
    fontSize: 11.2,
    color: "#4B5563",
    bold: false,
    italic: true,
    alignment: "Left",
    lineSpacing: 14.5,
    spaceBefore: 0,
    spaceAfter: 8,
    firstLineIndent: 0,
    leftIndent: 12,
    rightIndent: 12,
  },
  heading1: {
    fontName: "Aptos Display",
    fontSize: 13.8,
    color: "#1F2937",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 17,
    spaceBefore: 10,
    spaceAfter: 4,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#E3D8B8",
    borderBottomWidth: "Pt025",
  },
  heading2: {
    fontName: "Aptos",
    fontSize: 12.4,
    color: "#8A6F3D",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 15.5,
    spaceBefore: 8,
    spaceAfter: 3,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#E8DFC6",
    borderBottomWidth: "Pt025",
  },
  heading3: {
    fontName: "Aptos",
    fontSize: 11.1,
    color: "#4B5563",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 14.2,
    spaceBefore: 6,
    spaceAfter: 2,
    firstLineIndent: 0,
    leftIndent: 8,
    rightIndent: 0,
  },
  quote: {
    fontName: "Georgia",
    fontSize: 10.5,
    color: "#475569",
    bold: false,
    italic: true,
    alignment: "Justified",
    lineSpacing: 15.5,
    spaceBefore: 5,
    spaceAfter: 6,
    firstLineIndent: 0,
    leftIndent: 22,
    rightIndent: 12,
    borderLeftColor: "#D8C89A",
    borderLeftWidth: "Pt025",
    shadingColor: "#FAF9F5",
  },
};

const contractClarityFormats: Partial<Record<WordStyleRole, WordStyleFormat>> = {
  normal: {
    fontName: "Aptos",
    fontSize: 10.8,
    color: "#202124",
    bold: false,
    italic: false,
    alignment: "Justified",
    lineSpacing: 15.8,
    spaceBefore: 0,
    spaceAfter: 4,
    firstLineIndent: 14,
    leftIndent: 0,
    rightIndent: 0,
  },
  title: {
    fontName: "Aptos Display",
    fontSize: 17.5,
    color: "#263238",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 21,
    spaceBefore: 0,
    spaceAfter: 8,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#D8C89A",
    borderBottomWidth: "Pt050",
  },
  subtitle: {
    fontName: "Aptos",
    fontSize: 11,
    color: "#607D8B",
    bold: false,
    italic: false,
    alignment: "Left",
    lineSpacing: 14.2,
    spaceBefore: 0,
    spaceAfter: 8,
    firstLineIndent: 0,
    leftIndent: 12,
    rightIndent: 12,
  },
  heading1: {
    fontName: "Aptos Display",
    fontSize: 13.2,
    color: "#263238",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 16.5,
    spaceBefore: 9,
    spaceAfter: 4,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#E3D8B8",
    borderBottomWidth: "Pt025",
  },
  heading2: {
    fontName: "Aptos",
    fontSize: 12,
    color: "#8A6F3D",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 15,
    spaceBefore: 7,
    spaceAfter: 3,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#E8DFC6",
    borderBottomWidth: "Pt025",
  },
  heading3: {
    fontName: "Aptos",
    fontSize: 10.8,
    color: "#455A64",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 13.8,
    spaceBefore: 5,
    spaceAfter: 2,
    firstLineIndent: 0,
    leftIndent: 10,
    rightIndent: 0,
  },
  quote: {
    fontName: "Georgia",
    fontSize: 10.3,
    color: "#546E7A",
    bold: false,
    italic: true,
    alignment: "Justified",
    lineSpacing: 15,
    spaceBefore: 5,
    spaceAfter: 6,
    firstLineIndent: 0,
    leftIndent: 22,
    rightIndent: 12,
    borderLeftColor: "#D8C89A",
    borderLeftWidth: "Pt025",
    shadingColor: "#FAF9F5",
  },
};

const opinionBoardFormats: Partial<Record<WordStyleRole, WordStyleFormat>> = {
  normal: {
    fontName: "Georgia",
    fontSize: 11,
    color: "#2B2B2B",
    bold: false,
    italic: false,
    alignment: "Justified",
    lineSpacing: 16.8,
    spaceBefore: 0,
    spaceAfter: 5,
    firstLineIndent: 20,
    leftIndent: 0,
    rightIndent: 0,
  },
  title: {
    fontName: "Georgia",
    fontSize: 18.5,
    color: "#2F2F2F",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 22.5,
    spaceBefore: 0,
    spaceAfter: 9,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#D8C89A",
    borderBottomWidth: "Pt050",
  },
  subtitle: {
    fontName: "Georgia",
    fontSize: 11.2,
    color: "#6B3F35",
    bold: false,
    italic: true,
    alignment: "Left",
    lineSpacing: 15,
    spaceBefore: 0,
    spaceAfter: 8,
    firstLineIndent: 0,
    leftIndent: 12,
    rightIndent: 12,
  },
  heading1: {
    fontName: "Georgia",
    fontSize: 13.8,
    color: "#2F2F2F",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 17.2,
    spaceBefore: 11,
    spaceAfter: 4,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#E3D8B8",
    borderBottomWidth: "Pt025",
  },
  heading2: {
    fontName: "Georgia",
    fontSize: 12.3,
    color: "#8A6F3D",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 15.6,
    spaceBefore: 8,
    spaceAfter: 3,
    firstLineIndent: 0,
    leftIndent: 0,
    rightIndent: 0,
    borderBottomColor: "#E8DFC6",
    borderBottomWidth: "Pt025",
  },
  heading3: {
    fontName: "Georgia",
    fontSize: 11,
    color: "#7A5A28",
    bold: true,
    italic: false,
    alignment: "Left",
    lineSpacing: 14.2,
    spaceBefore: 5,
    spaceAfter: 2,
    firstLineIndent: 0,
    leftIndent: 8,
    rightIndent: 0,
  },
  quote: {
    fontName: "Georgia",
    fontSize: 10.5,
    color: "#5F6368",
    bold: false,
    italic: true,
    alignment: "Justified",
    lineSpacing: 15.8,
    spaceBefore: 5,
    spaceAfter: 6,
    firstLineIndent: 0,
    leftIndent: 24,
    rightIndent: 12,
    borderLeftColor: "#D8C89A",
    borderLeftWidth: "Pt025",
    shadingColor: "#FAF9F5",
  },
};

type EditorialPalette = {
  title: string;
  subtitle: string;
  body: string;
  accent: string;
  muted: string;
  line: string;
  lineSoft: string;
  quoteBg: string;
};

const withEditorialPalette = (
  base: Partial<Record<WordStyleRole, WordStyleFormat>>,
  palette: EditorialPalette
): Partial<Record<WordStyleRole, WordStyleFormat>> => ({
  ...base,
  normal: {
    ...base.normal,
    color: palette.body,
  },
  title: {
    ...base.title,
    color: palette.title,
    borderBottomColor: palette.line,
  },
  subtitle: {
    ...base.subtitle,
    color: palette.subtitle,
  },
  heading1: {
    ...base.heading1,
    color: palette.title,
    borderBottomColor: palette.lineSoft,
  },
  heading2: {
    ...base.heading2,
    color: palette.accent,
    borderBottomColor: palette.lineSoft,
  },
  heading3: {
    ...base.heading3,
    color: palette.muted,
  },
  quote: {
    ...base.quote,
    color: palette.muted,
    borderLeftColor: palette.line,
    shadingColor: palette.quoteBg,
  },
});

const navyGoldPalette: EditorialPalette = {
  title: "#10233F",
  subtitle: "#536173",
  body: "#20242A",
  accent: "#8A6F3D",
  muted: "#4B5563",
  line: "#D7C28A",
  lineSoft: "#E6DAB8",
  quoteBg: "#FAF8F1",
};

const graphiteChampagnePalette: EditorialPalette = {
  title: "#27272A",
  subtitle: "#5F6065",
  body: "#242426",
  accent: "#9A7B4F",
  muted: "#575A60",
  line: "#D6C6A5",
  lineSoft: "#E8DDC7",
  quoteBg: "#FAF9F6",
};

const slateSagePalette: EditorialPalette = {
  title: "#1F342D",
  subtitle: "#52635C",
  body: "#242A27",
  accent: "#2E6B57",
  muted: "#52605A",
  line: "#B9C7B4",
  lineSoft: "#DCE4D8",
  quoteBg: "#F6FAF7",
};

const mineralBurgundyPalette: EditorialPalette = {
  title: "#38272B",
  subtitle: "#66565A",
  body: "#2B2829",
  accent: "#8B2F3C",
  muted: "#62575A",
  line: "#D3B0A8",
  lineSoft: "#E9D8D4",
  quoteBg: "#FAF7F6",
};

const carbonCopperPalette: EditorialPalette = {
  title: "#1F2529",
  subtitle: "#596064",
  body: "#222628",
  accent: "#9B6847",
  muted: "#565E62",
  line: "#C89B75",
  lineSoft: "#E1C9B5",
  quoteBg: "#FAF7F4",
};

const navyGoldFormats = withEditorialPalette(visualLawPremiumFormats, navyGoldPalette);
const graphiteChampagneFormats = withEditorialPalette(
  visualLawPremiumFormats,
  graphiteChampagnePalette
);
const slateSageFormats = withEditorialPalette(contractClarityFormats, slateSagePalette);
const mineralBurgundyFormats = withEditorialPalette(opinionBoardFormats, mineralBurgundyPalette);
const carbonCopperFormats = withEditorialPalette(visualLawPremiumFormats, carbonCopperPalette);

export const THEME_PRESETS: DocumentTheme[] = [
  {
    id: "visual-law-premium",
    name: "Navy Gold",
    headingColor: navyGoldPalette.title,
    accentColor: navyGoldPalette.accent,
    bodyColor: navyGoldPalette.body,
    bodyFontName: "Aptos",
    bodyFontSize: 11,
    bodyLineSpacing: 16.2,
    paragraphSpaceAfter: 4,
    paragraphFirstLineIndent: 18,
    headingFontName: "Aptos Display",
    titleFontName: "Aptos Display",
    subtitleFontName: "Aptos",
    heading1FontName: "Aptos Display",
    heading2FontName: "Aptos",
    heading3FontName: "Aptos",
    titleFontSize: 18.5,
    subtitleFontSize: 11.2,
    heading1FontSize: 13.8,
    heading2FontSize: 12.4,
    heading3FontSize: 11.1,
    quoteColor: navyGoldPalette.muted,
    quoteFontName: "Georgia",
    quoteFontSize: 10.5,
    quoteLeftIndent: 22,
    tableStyle: "GridTable5Dark_Accent4",
    chartPalette: [
      navyGoldPalette.title,
      navyGoldPalette.accent,
      navyGoldPalette.muted,
      "#6F7E8C",
      navyGoldPalette.line,
    ],
    wordStyleFormats: navyGoldFormats,
  },
  {
    id: "corporativo-azul",
    name: "Grafite Champagne",
    headingColor: graphiteChampagnePalette.title,
    accentColor: graphiteChampagnePalette.accent,
    bodyColor: graphiteChampagnePalette.body,
    bodyFontName: "Aptos",
    bodyFontSize: 11,
    bodyLineSpacing: 16,
    paragraphSpaceAfter: 4,
    paragraphFirstLineIndent: 18,
    headingFontName: "Aptos Display",
    titleFontName: "Aptos Display",
    subtitleFontName: "Aptos",
    heading1FontName: "Aptos Display",
    heading2FontName: "Aptos",
    heading3FontName: "Aptos",
    titleFontSize: 18,
    subtitleFontSize: 11,
    heading1FontSize: 13.5,
    heading2FontSize: 12.3,
    heading3FontSize: 11,
    quoteColor: graphiteChampagnePalette.muted,
    quoteFontName: "Georgia",
    quoteFontSize: 10.5,
    quoteLeftIndent: 22,
    tableStyle: "GridTable5Dark_Accent1",
    chartPalette: [
      graphiteChampagnePalette.title,
      graphiteChampagnePalette.accent,
      graphiteChampagnePalette.muted,
      "#74777D",
      graphiteChampagnePalette.line,
    ],
    wordStyleFormats: graphiteChampagneFormats,
  },
  {
    id: "juridico-sobrio",
    name: "Rubi Mineral",
    headingColor: mineralBurgundyPalette.title,
    accentColor: mineralBurgundyPalette.accent,
    bodyColor: mineralBurgundyPalette.body,
    bodyFontName: "Georgia",
    bodyFontSize: 11,
    bodyLineSpacing: 16.8,
    paragraphSpaceAfter: 5,
    paragraphFirstLineIndent: 20,
    headingFontName: "Georgia",
    titleFontName: "Georgia",
    subtitleFontName: "Georgia",
    heading1FontName: "Georgia",
    heading2FontName: "Georgia",
    heading3FontName: "Georgia",
    titleFontSize: 18.5,
    subtitleFontSize: 11.2,
    heading1FontSize: 13.8,
    heading2FontSize: 12.3,
    heading3FontSize: 11,
    quoteColor: mineralBurgundyPalette.muted,
    quoteFontName: "Georgia",
    quoteFontSize: 10.5,
    quoteLeftIndent: 24,
    tableStyle: "GridTable4_Accent2",
    chartPalette: [
      mineralBurgundyPalette.title,
      mineralBurgundyPalette.accent,
      mineralBurgundyPalette.muted,
      "#8A6F3D",
      mineralBurgundyPalette.line,
    ],
    wordStyleFormats: mineralBurgundyFormats,
  },
  {
    id: "moderno-verde",
    name: "Verde Profundo",
    headingColor: slateSagePalette.title,
    accentColor: slateSagePalette.accent,
    bodyColor: slateSagePalette.body,
    bodyFontName: "Aptos",
    bodyFontSize: 10.8,
    bodyLineSpacing: 15.8,
    paragraphSpaceAfter: 4,
    paragraphFirstLineIndent: 14,
    headingFontName: "Aptos Display",
    titleFontName: "Aptos Display",
    subtitleFontName: "Aptos",
    heading1FontName: "Aptos Display",
    heading2FontName: "Aptos",
    heading3FontName: "Aptos",
    titleFontSize: 17.5,
    subtitleFontSize: 11,
    heading1FontSize: 13.2,
    heading2FontSize: 12,
    heading3FontSize: 10.8,
    quoteColor: slateSagePalette.muted,
    quoteFontName: "Georgia",
    quoteFontSize: 10.3,
    quoteLeftIndent: 22,
    tableStyle: "GridTable5Dark_Accent3",
    chartPalette: [
      slateSagePalette.title,
      slateSagePalette.accent,
      slateSagePalette.muted,
      "#8A6F3D",
      slateSagePalette.line,
    ],
    wordStyleFormats: slateSageFormats,
  },
  {
    id: "executivo-grafite",
    name: "Carbono Cobre",
    headingColor: carbonCopperPalette.title,
    accentColor: carbonCopperPalette.accent,
    bodyColor: carbonCopperPalette.body,
    bodyFontName: "Aptos",
    bodyFontSize: 11,
    bodyLineSpacing: 16.2,
    paragraphSpaceAfter: 4,
    paragraphFirstLineIndent: 16,
    headingFontName: "Aptos Display",
    titleFontName: "Aptos Display",
    subtitleFontName: "Aptos",
    heading1FontName: "Aptos Display",
    heading2FontName: "Aptos",
    heading3FontName: "Aptos",
    titleFontSize: 18.5,
    subtitleFontSize: 11.2,
    heading1FontSize: 13.8,
    heading2FontSize: 12.4,
    heading3FontSize: 11.1,
    quoteColor: carbonCopperPalette.muted,
    quoteFontName: "Georgia",
    quoteFontSize: 10.5,
    quoteLeftIndent: 22,
    tableStyle: "GridTable5Dark_Accent6",
    chartPalette: [
      carbonCopperPalette.title,
      carbonCopperPalette.accent,
      carbonCopperPalette.muted,
      "#6F777A",
      carbonCopperPalette.line,
    ],
    wordStyleFormats: carbonCopperFormats,
  },
];

export const DEFAULT_THEME = THEME_PRESETS[0];
