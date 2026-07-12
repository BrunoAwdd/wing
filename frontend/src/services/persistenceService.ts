import { get, set, del } from "idb-keyval";
import { DocumentTheme } from "../utils/themes";

const THEME_KEY = "wing_theme";

export const persistenceService = {
  /**
   * Saves the user's chosen document design theme.
   * @param theme The theme (preset + overrides) to persist.
   */
  saveTheme: async (theme: DocumentTheme): Promise<void> => {
    try {
      await set(THEME_KEY, theme);
      console.log("[Persistence] Theme saved.");
    } catch (error) {
      console.error("[Persistence] Failed to save theme:", error);
    }
  },

  /**
   * Loads the persisted document design theme, if any.
   * @returns The saved theme or null if not found.
   */
  loadTheme: async (): Promise<DocumentTheme | null> => {
    try {
      const theme = await get<DocumentTheme>(THEME_KEY);
      return theme || null;
    } catch (error) {
      console.error("[Persistence] Failed to load theme:", error);
      return null;
    }
  },

  /**
   * Saves the serialized index (bincode-encoded bytes) to IndexedDB.
   * @param docId The unique identifier for the document (e.g., URL).
   * @param data The serialized index.
   */
  saveIndex: async (docId: string, data: Uint8Array): Promise<void> => {
    try {
      await set(`wing_index_${docId}`, data);
      console.log(`[Persistence] Index saved for ${docId}`);
    } catch (error) {
      console.error("[Persistence] Failed to save index:", error);
    }
  },

  /**
   * Loads the serialized index from IndexedDB.
   * @param docId The unique identifier for the document.
   * @returns The serialized index bytes or null if not found.
   */
  loadIndex: async (docId: string): Promise<Uint8Array | null> => {
    try {
      const data = await get<Uint8Array>(`wing_index_${docId}`);
      if (data) {
        console.log(`[Persistence] Index loaded for ${docId}`);
        return data;
      }
      return null;
    } catch (error) {
      console.error("[Persistence] Failed to load index:", error);
      return null;
    }
  },

  /**
   * Clears the index for a specific document.
   * @param docId The unique identifier for the document.
   */
  clearIndex: async (docId: string): Promise<void> => {
    try {
      await del(`wing_index_${docId}`);
      console.log(`[Persistence] Index cleared for ${docId}`);
    } catch (error) {
      console.error("[Persistence] Failed to clear index:", error);
    }
  },
};
