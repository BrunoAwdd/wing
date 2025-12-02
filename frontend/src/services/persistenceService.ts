import { get, set, del } from "idb-keyval";

export const persistenceService = {
  /**
   * Saves the serialized index to IndexedDB.
   * @param docId The unique identifier for the document (e.g., URL).
   * @param data The serialized index (any).
   */
  saveIndex: async (docId: string, data: any): Promise<void> => {
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
   * @returns The serialized index or null if not found.
   */
  loadIndex: async (docId: string): Promise<any | null> => {
    try {
      const data = await get<any>(`wing_index_${docId}`);
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

  /**
   * Saves the list of agents to IndexedDB.
   * @param agents The list of agents to cache.
   */
  saveAgents: async (agents: any[]): Promise<void> => {
    try {
      await set("wing_agents_cache", agents);
      console.log(`[Persistence] Agents cached: ${agents.length}`);
    } catch (error) {
      console.error("[Persistence] Failed to save agents:", error);
    }
  },

  /**
   * Loads the list of agents from IndexedDB.
   * @returns The list of agents or null if not found.
   */
  loadAgents: async (): Promise<any[] | null> => {
    try {
      const data = await get<any[]>("wing_agents_cache");
      if (data) {
        console.log(`[Persistence] Agents loaded from cache: ${data.length}`);
        return data;
      }
      return null;
    } catch (error) {
      console.error("[Persistence] Failed to load agents:", error);
      return null;
    }
  },
};
