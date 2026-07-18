import { Paragraph } from "../hooks/useWordInteraction";

const HISTORY_KEY = "suggestionHistory";

// Helper to generate a stable ID for a set of paragraphs
const generateIdForText = (paragraphs: Paragraph[]): string => {
  const combinedText = paragraphs.map((p) => p.text).join("\n");
  let hash = 0;
  for (let i = 0; i < combinedText.length; i++) {
    const char = combinedText.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return `text-id-${hash}`;
};

// --- Type Definitions ---

export type SuggestionSet = {
  [command: string]: Paragraph[];
};

export type HistoryEntry = {
  originalText: Paragraph[];
  suggestions: SuggestionSet;
};

export type SuggestionHistory = {
  [textId: string]: HistoryEntry;
};

// --- Public API ---

/**
 * Saves a set of suggestions for a given original text and command.
 * @param originalText The original paragraphs the suggestion is for.
 * @param command The command that generated the suggestion (e.g., 'fix', 'translate').
 * @param suggestions The array of suggestion paragraphs.
 */
export const saveSuggestion = (
  originalText: Paragraph[],
  command: string,
  suggestions: Paragraph[]
) => {
  if (!originalText || originalText.length === 0) return;

  try {
    const textId = generateIdForText(originalText);
    const history = getFullHistory();

    if (!history[textId]) {
      history[textId] = {
        originalText: originalText,
        suggestions: {},
      };
    }

    history[textId].suggestions[command] = suggestions;

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  } catch (error) {
    console.error("Error saving suggestion to localStorage:", error);
  }
};

/**
 * Retrieves the entire suggestion history.
 * @returns The full suggestion history object.
 */
export const getFullHistory = (): SuggestionHistory => {
  try {
    const historyJson = localStorage.getItem(HISTORY_KEY);
    return historyJson ? JSON.parse(historyJson) : {};
  } catch (error) {
    console.error("Error reading suggestion history from localStorage:", error);
    return {}; // Return empty history on error
  }
};

/**
 * Clears the entire suggestion history from localStorage.
 */
export const clearHistory = () => {
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    console.error("Error clearing suggestion history:", error);
  }
};
