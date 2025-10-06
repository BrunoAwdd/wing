import { Paragraph } from "../hooks/useWordInteraction";

let suggestionStore: Paragraph[] = [];

export const getSuggestions = (): Paragraph[] => {
  return suggestionStore;
};

export const setSuggestions = (suggestions: Paragraph[]) => {
  suggestionStore = suggestions;
};

export const removeSuggestion = (id: string) => {
  suggestionStore = suggestionStore.filter((s) => s.id !== id);
};

export const clearSuggestions = () => {
  suggestionStore = [];
};
