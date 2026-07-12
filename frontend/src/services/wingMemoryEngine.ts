import init, { WingMemoryEngine } from "../pkg/wing_memory_engine";
import { persistenceService } from "./persistenceService";
import { get as idbGet, set as idbSet } from "idb-keyval";

let engine: WingMemoryEngine | null = null;
let currentDocId: string | null = null;

// Model assets are bundled and served from the add-in's own origin (see
// webpack.config.js `assets/model` copy pattern) instead of being fetched
// from huggingface.co at runtime, so the feature doesn't depend on an
// external host being reachable from the user's network.
const MODEL_ASSET_VERSION = "all-MiniLM-L6-v2-v1";
const MODEL_URL = "/assets/model/model.safetensors";
const CONFIG_URL = "/assets/model/config.json";
const TOKENIZER_URL = "/assets/model/tokenizer.json";

const loadAssetCached = async (url: string, cacheKey: string): Promise<Uint8Array> => {
  const cached = await idbGet<ArrayBuffer>(cacheKey);
  if (cached) {
    return new Uint8Array(cached);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  await idbSet(cacheKey, buffer);
  return new Uint8Array(buffer);
};

export const initEngine = async (docId: string) => {
  if (engine) return engine;
  currentDocId = docId;

  await init();
  const newEngine = new WingMemoryEngine();
  console.log("[WingMemoryEngine] WASM initialized.");

  // Load persisted index if available
  const persistedData = await persistenceService.loadIndex(docId);
  if (persistedData) {
    try {
      newEngine.load(persistedData);
      console.log(`[WingMemoryEngine] Loaded persisted index for ${docId}.`);
    } catch (e) {
      console.error("[WingMemoryEngine] Failed to deserialize index:", e);
    }
  }

  console.log("[WingMemoryEngine] Loading model and tokenizer...");
  const [modelBuffer, configBuffer, tokenizerBuffer] = await Promise.all([
    loadAssetCached(MODEL_URL, `${MODEL_ASSET_VERSION}:model`),
    loadAssetCached(CONFIG_URL, `${MODEL_ASSET_VERSION}:config`),
    loadAssetCached(TOKENIZER_URL, `${MODEL_ASSET_VERSION}:tokenizer`),
  ]);

  // Any failure above throws, and we deliberately do not fall back to a
  // "working" engine with no model loaded: without real embeddings,
  // query() would silently return meaningless zero-vector results instead
  // of a visible error.
  newEngine.load_model(modelBuffer, configBuffer);
  newEngine.load_tokenizer(tokenizerBuffer);
  console.log("[WingMemoryEngine] Model and tokenizer loaded successfully.");

  engine = newEngine;
  return engine;
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
