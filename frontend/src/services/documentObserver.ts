import { ingestText, clearIndex } from "./wingMemoryEngine";

export const documentObserver = {
  /**
   * Reads the entire document content and syncs it with the Wing Memory Engine.
   * This is a "Sync Now" approach: Clear Index -> Read All -> Ingest All.
   */
  syncDocument: async (): Promise<void> => {
    try {
      await Word.run(async (context) => {
        console.log("[DocumentObserver] Starting sync...");

        // 1. Read all paragraphs
        const body = context.document.body;
        const paragraphs = body.paragraphs;
        paragraphs.load("text");

        await context.sync();

        const texts: string[] = [];
        paragraphs.items.forEach((p) => {
          const text = p.text.trim();
          if (text.length > 0) {
            texts.push(text);
          }
        });

        console.log(`[DocumentObserver] Read ${texts.length} paragraphs.`);

        // 2. Clear existing index
        clearIndex();

        // 3. Ingest new text
        if (texts.length > 0) {
          await ingestText(texts);
        }

        console.log("[DocumentObserver] Sync complete.");
      });
    } catch (error) {
      console.error("[DocumentObserver] Sync failed:", error);
    }
  },
};
