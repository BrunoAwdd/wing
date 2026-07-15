export interface RemoteCacheClient {
  create(params: {
    model: string;
    documentText: string;
    systemInstruction: string;
    ttlSeconds: number;
  }): Promise<{ name: string } | null>;
  delete(name: string): Promise<void>;
}

export interface TimeProvider {
  now(): number;
}

export interface SleepProvider {
  sleep(delayMs: number): Promise<void>;
}
