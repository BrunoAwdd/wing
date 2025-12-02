import init, { WingMemoryEngine } from "../pkg/wing_memory_engine";
import { persistenceService } from "./persistenceService";

let engine: WingMemoryEngine | null = null;
let currentDocId: string | null = null;

export const initEngine = async (docId: string) => {
  if (engine) return engine;
  currentDocId = docId;

  try {
    await init();
    engine = new WingMemoryEngine();
    console.log("[WingMemoryEngine] WASM initialized.");

    // Load persisted index if available
    const persistedData = await persistenceService.loadIndex(docId);
    if (persistedData) {
      try {
        engine.load(persistedData);
        console.log(`[WingMemoryEngine] Loaded persisted index for ${docId}.`);
      } catch (e) {
        console.error("[WingMemoryEngine] Failed to deserialize index:", e);
      }
    }

    // Load Model
    // TODO: Point to a real URL or local asset. For now, we expect the user to have this file or we fail gracefully.
    // In a real app, we might use a CDN or bundled asset.
    const modelUrl =
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/model.safetensors";
    const configUrl =
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/config.json";
    const tokenizerUrl =
      "https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2/resolve/main/tokenizer.json";

    console.log("[WingMemoryEngine] Fetching model and tokenizer...");
    // Note: This might fail with CORS if not proxied or allowed.
    // For local dev, we might need to download these files to `frontend/assets`.

    try {
      const [modelRes, configRes, tokenizerRes] = await Promise.all([
        fetch(modelUrl),
        fetch(configUrl),
        fetch(tokenizerUrl),
      ]);

      if (!modelRes.ok || !configRes.ok || !tokenizerRes.ok) {
        throw new Error(
          `Failed to fetch assets: ${modelRes.status} ${configRes.status} ${tokenizerRes.status}`
        );
      }

      const modelBuffer = new Uint8Array(await modelRes.arrayBuffer());
      const configBuffer = new Uint8Array(await configRes.arrayBuffer());
      const tokenizerBuffer = new Uint8Array(await tokenizerRes.arrayBuffer());

      engine.load_model(modelBuffer, configBuffer);
      engine.load_tokenizer(tokenizerBuffer);
      console.log("[WingMemoryEngine] Model and Tokenizer loaded successfully.");
    } catch (e) {
      console.error("[WingMemoryEngine] Failed to load assets. Embeddings will be mock zeros.", e);
    }

    return engine;
  } catch (error) {
    console.error("[WingMemoryEngine] Failed to initialize:", error);
    throw error;
  }
};

export const getEngine = () => {
  if (!engine) {
    throw new Error("[WingMemoryEngine] Engine not initialized. Call initEngine() first.");
  }
  return engine;
};

export const saveEngine = async (docId: string) => {
  const eng = getEngine();
  try {
    const serialized = eng.serialize();
    // serialized is a JsValue (likely Object or Map), we need to ensure it's Uint8Array or compatible for storage.
    // Actually, serde_wasm_bindgen::to_value returns a JS object representation.
    // Wait, IndexedDB can store objects directly! But our RFC said Uint8Array.
    // If `serialize` returns a JS object, we can store it directly in IndexedDB.
    // However, for efficiency and strict typing, we might want to ensure it's binary.
    // But `serde_wasm_bindgen` converts to JS values.
    // Let's assume for now we store whatever `serialize` returns.
    // BUT `persistenceService` expects `Uint8Array`.
    // We should probably update `serialize` in Rust to return `Vec<u8>` (bytes) using `bincode` or similar if we want binary.
    // OR we update `persistenceService` to accept `any`.
    // Given Phase 1.4 implementation: `serde_wasm_bindgen::to_value` returns a JS value (Map/Object).
    // Let's update `persistenceService` to accept `any` for now to be flexible, or use JSON.stringify if needed.
    // Actually, IndexedDB handles structured cloning, so Objects/Maps are fine.
    // I will update `persistenceService` signature to `any`.
    await persistenceService.saveIndex(docId, serialized);
  } catch (e) {
    console.error("[WingMemoryEngine] Failed to save:", e);
  }
};

export const ingestText = async (texts: string[]) => {
  const eng = getEngine();
  const ids = eng.ingest(texts);
  console.log(`[WingMemoryEngine] Ingested ${ids.length} chunks.`);

  if (currentDocId) {
    await saveEngine(currentDocId);
  }

  return ids;
};

export const queryText = (query: string, topK: number = 5) => {
  const eng = getEngine();
  const results = eng.query(query, topK);
  return results;
};

export const clearIndex = () => {
  const eng = getEngine();
  eng.clear();
  console.log("[WingMemoryEngine] Index cleared.");
};
