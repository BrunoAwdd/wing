export interface ChatHistoryEntryPart {
  text: string;
}

export interface ChatHistoryEntry {
  role: "user" | "model";
  parts: ChatHistoryEntryPart[];
}

export const DEFAULT_CONTEXT_WINDOW_ENTRIES = 10;
const SUMMARY_ENTRY_MAX_CHARS = 480;
const TURN_MAX_CHARS = 70;

const extractText = (entry: ChatHistoryEntry): string =>
  entry.parts.map((part) => part.text).join(" ").trim();

const truncate = (text: string, maxChars: number): string =>
  text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;

const summarizeEntries = (entries: ChatHistoryEntry[]): string => {
  const lines = entries.map((entry) => {
    const prefix = entry.role === "user" ? "P" : "R";
    return `${prefix}: ${truncate(extractText(entry), TURN_MAX_CHARS)}`;
  });

  return truncate(
    `[Resumo de ${entries.length} turno(s) anteriores nesta conversa]\n${lines.join("\n")}`,
    SUMMARY_ENTRY_MAX_CHARS,
  );
};

export const compactHistory = (
  history: ChatHistoryEntry[],
  windowEntries: number = DEFAULT_CONTEXT_WINDOW_ENTRIES,
): ChatHistoryEntry[] => {
  if (history.length <= windowEntries) return history;

  const compactedCount = history.length - windowEntries;
  const older = history.slice(0, compactedCount);
  const recent = history.slice(compactedCount);

  const summaryEntries: ChatHistoryEntry[] = [
    { role: "user", parts: [{ text: summarizeEntries(older) }] },
    { role: "model", parts: [{ text: "Entendido, vou considerar esse contexto." }] },
  ];

  return [...summaryEntries, ...recent];
};
