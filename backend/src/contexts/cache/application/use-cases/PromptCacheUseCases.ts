import {
  RemoteCacheClient,
  SleepProvider,
  TimeProvider,
} from "../ports/out/CachePorts.ts";
import { hashDocumentKey } from "../../domain/PromptCacheKey.ts";

export interface CachedPrefix {
  name: string;
  expiresAt: number;
  appSessionId: string;
}

export class PromptCacheUseCases {
  private readonly cache = new Map<string, CachedPrefix>();
  private readonly endedAppSessions = new Map<string, number>();
  private readonly CREATE_RACE_TOMBSTONE_MS = 10 * 60 * 1000;

  constructor(
    private readonly client: RemoteCacheClient,
    private readonly timeProvider: TimeProvider,
    private readonly sleepProvider: SleepProvider,
    private readonly createTimeoutMs: number = 30_000,
  ) {}

  private pruneEndedAppSessions(now: number) {
    for (const [id, expiresAt] of this.endedAppSessions) {
      if (expiresAt <= now) this.endedAppSessions.delete(id);
    }
  }

  private async deleteRemote(name: string, remoteExpiresAt: number) {
    const delays = [0, 1_000, 5_000, 30_000];
    for (const delay of delays) {
      if (delay > 0) await this.sleepProvider.sleep(delay);
      try {
        await this.client.delete(name);
        return;
      } catch (error) {
        if (
          this.timeProvider.now() + (delays[delays.indexOf(delay) + 1] ?? 0) >=
            remoteExpiresAt
        ) {
          console.error(
            "[PromptCacheUseCases] Falha ao excluir cache remoto antes do TTL:",
            error,
          );
          return;
        }
      }
    }
  }

  async getOrCreate(params: {
    accountId: string;
    documentText: string;
    model: string;
    systemInstruction: string;
    ttlSeconds: number;
    appSessionId: string;
    promptVersion?: string;
  }): Promise<{ name: string; hit: boolean } | null> {
    const key = await hashDocumentKey(
      params.accountId,
      params.documentText,
      params.model,
      params.appSessionId,
      params.promptVersion,
      params.systemInstruction,
    );
    const now = this.timeProvider.now();
    const existing = this.cache.get(key);
    if (existing && existing.expiresAt > now) {
      return { name: existing.name, hit: true };
    }

    const remoteExpiresAt = now + params.ttlSeconds * 1000;
    const createPromise = this.client.create({
      model: params.model,
      documentText: params.documentText,
      systemInstruction: params.systemInstruction,
      ttlSeconds: params.ttlSeconds,
    });

    let timeoutId: number | undefined;
    const timedOut = Symbol("cache-create-timeout");
    const timeoutPromise = new Promise<typeof timedOut>((resolve) => {
      timeoutId = setTimeout(
        () => resolve(timedOut),
        this.createTimeoutMs,
      ) as unknown as number;
    });

    const createResult = await Promise.race([createPromise, timeoutPromise]);
    if (timeoutId !== undefined) clearTimeout(timeoutId);

    if (createResult === timedOut) {
      void createPromise.then((late) => {
        if (late) return this.deleteRemote(late.name, remoteExpiresAt);
      }).catch(() => {});
      return null;
    }

    const created = createResult;
    if (!created) return null;

    const nowAfterCreate = this.timeProvider.now();
    this.pruneEndedAppSessions(nowAfterCreate);
    if (this.endedAppSessions.has(params.appSessionId)) {
      await this.deleteRemote(created.name, remoteExpiresAt);
      return null;
    }

    this.cache.set(key, {
      name: created.name,
      expiresAt: remoteExpiresAt,
      appSessionId: params.appSessionId,
    });
    return { name: created.name, hit: false };
  }

  async invalidateAppSession(appSessionId: string): Promise<void> {
    const now = this.timeProvider.now();
    this.endedAppSessions.set(
      appSessionId,
      now + this.CREATE_RACE_TOMBSTONE_MS,
    );
    this.pruneEndedAppSessions(now);

    const toDelete = Array.from(this.cache.entries()).filter(
      ([, entry]) => entry.appSessionId === appSessionId,
    );
    for (const [key, entry] of toDelete) {
      this.cache.delete(key);
      await this.deleteRemote(entry.name, entry.expiresAt);
    }
  }

  size(): number {
    return this.cache.size;
  }
}
