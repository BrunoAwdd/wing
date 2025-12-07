/* tslint:disable */
/* eslint-disable */

export class WingMemoryEngine {
  free(): void;
  [Symbol.dispose](): void;
  constructor();
  load_model(weights: Uint8Array, config_json: Uint8Array): void;
  load_tokenizer(json: Uint8Array): void;
  /**
   * Ingests a list of text chunks.
   */
  ingest(texts: string[]): Uint32Array;
  /**
   * Queries the vector store for similar chunks.
   */
  query(query_text: string, top_k: number): any;
  delete_chunk(id: number): void;
  clear(): void;
  serialize(): any;
  load(serialized: any): void;
}

export function main_js(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
  readonly memory: WebAssembly.Memory;
  readonly main_js: () => void;
  readonly __wbg_wingmemoryengine_free: (a: number, b: number) => void;
  readonly wingmemoryengine_new: () => number;
  readonly wingmemoryengine_load_model: (a: number, b: number, c: number, d: number, e: number) => [number, number];
  readonly wingmemoryengine_load_tokenizer: (a: number, b: number, c: number) => [number, number];
  readonly wingmemoryengine_ingest: (a: number, b: number, c: number) => [number, number, number, number];
  readonly wingmemoryengine_query: (a: number, b: number, c: number, d: number) => [number, number, number];
  readonly wingmemoryengine_delete_chunk: (a: number, b: number) => void;
  readonly wingmemoryengine_clear: (a: number) => void;
  readonly wingmemoryengine_serialize: (a: number) => any;
  readonly wingmemoryengine_load: (a: number, b: any) => [number, number];
  readonly __wbindgen_malloc: (a: number, b: number) => number;
  readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
  readonly __wbindgen_exn_store: (a: number) => void;
  readonly __externref_table_alloc: () => number;
  readonly __wbindgen_externrefs: WebAssembly.Table;
  readonly __wbindgen_free: (a: number, b: number, c: number) => void;
  readonly __externref_table_dealloc: (a: number) => void;
  readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
* Instantiates the given `module`, which can either be bytes or
* a precompiled `WebAssembly.Module`.
*
* @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
*
* @returns {InitOutput}
*/
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
* If `module_or_path` is {RequestInfo} or {URL}, makes a request and
* for everything else, calls `WebAssembly.instantiate` directly.
*
* @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
*
* @returns {Promise<InitOutput>}
*/
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
