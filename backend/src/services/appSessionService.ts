import { geminiContextCache } from "./geminiContextCache.ts";
import type { AppSession as DomainAppSession } from "../contexts/app-sessions/domain/AppSession.ts";
import { AppSessionUseCases } from "../contexts/app-sessions/application/use-cases/AppSessionUseCases.ts";
import { InMemoryAppSessionRepository } from "../contexts/app-sessions/infrastructure/adapters/InMemoryAppSessionRepository.ts";
import { TimerService } from "../contexts/app-sessions/application/ports/out/TimerService.ts";

export interface AppSession {
  appSessionId: string;
  accountId: string;
  documentId: string;
  createdAt: number;
  lastHeartbeatAt: number;
  expiresAt: number;
  absoluteExpiresAt: number;
  timeoutId: number;
}

export interface AppSessionServiceConfig {
  ttlMs: number;
  maxDurationMs: number;
  now: () => number;
  randomUUID: () => string;
  scheduleExpiration: (callback: () => void, delay: number) => number;
  cancelExpiration: (timeoutId: number) => void;
  onSessionEnd: (appSessionId: string) => void;
}

const positiveInteger = (name: string, fallback: number): number => {
  const value = Number(Deno.env.get(name));
  return Number.isInteger(value) && value > 0 ? value : fallback;
};

const defaultConfig: AppSessionServiceConfig = {
  ttlMs: positiveInteger("WING_APP_SESSION_TTL_MS", 10 * 60 * 1000),
  maxDurationMs: positiveInteger(
    "WING_APP_SESSION_MAX_DURATION_MS",
    60 * 60 * 1000,
  ),
  now: Date.now,
  randomUUID: () => crypto.randomUUID(),
  scheduleExpiration: (callback, delay) => {
    const timeoutId = setTimeout(callback, delay) as unknown as number;
    Deno.unrefTimer(timeoutId);
    return timeoutId;
  },
  cancelExpiration: (timeoutId) => clearTimeout(timeoutId),
  onSessionEnd: (appSessionId) => {
    geminiContextCache.invalidateAppSession(appSessionId).catch((error) => {
      console.error(
        "[AppSessionService] Falha ao invalidar cache remoto da app session:",
        error,
      );
    });
  },
};

export const createAppSessionService = (
  config: AppSessionServiceConfig = defaultConfig,
) => {
  const repository = new InMemoryAppSessionRepository();
  const cacheInvalidator = {
    invalidateAppSession: async (id: string) => {
      config.onSessionEnd(id);
    },
  };
  const timeProvider = { now: config.now };
  const idGenerator = { generateId: config.randomUUID };

  const timerService = new (class implements TimerService {
    private map = new Map<string, number>();
    scheduleExpiration(
      appSessionId: string,
      delay: number,
      onExpire: (id: string) => void,
    ): void {
      this.cancelExpiration(appSessionId);
      const handle = config.scheduleExpiration(() => {
        this.map.delete(appSessionId);
        onExpire(appSessionId);
      }, delay);
      this.map.set(appSessionId, handle);
    }
    cancelExpiration(appSessionId: string): void {
      const handle = this.map.get(appSessionId);
      if (handle !== undefined) {
        config.cancelExpiration(handle);
        this.map.delete(appSessionId);
      }
    }
  })();

  const useCases = new AppSessionUseCases(
    repository,
    cacheInvalidator,
    timeProvider,
    idGenerator,
    timerService,
    config.ttlMs,
    config.maxDurationMs,
  );

  const mapToLegacy = (session: DomainAppSession): AppSession => ({
    appSessionId: session.id,
    accountId: session.accountId,
    documentId: session.documentId,
    createdAt: session.createdAt,
    lastHeartbeatAt: session.lastHeartbeatAt,
    expiresAt: session.expiresAt,
    absoluteExpiresAt: session.absoluteExpiresAt,
    timeoutId: -1,
  });

  const register = (accountId: string, documentId: string): AppSession => {
    return mapToLegacy(useCases.register(accountId, documentId));
  };

  const validate = (
    appSessionId: string,
    accountId: string,
  ): AppSession | null => {
    const session = useCases.validate(appSessionId, accountId);
    return session ? mapToLegacy(session) : null;
  };

  const heartbeat = (
    appSessionId: string,
    accountId: string,
  ): AppSession | null => {
    const session = useCases.heartbeat(appSessionId, accountId);
    return session ? mapToLegacy(session) : null;
  };

  const close = (appSessionId: string, accountId: string): void => {
    useCases.close(appSessionId, accountId);
  };

  return { register, validate, heartbeat, close };
};

export type AppSessionService = ReturnType<typeof createAppSessionService>;

export const appSessionService = createAppSessionService();
