import { AppSession } from "../../domain/AppSession.ts";
import { AppSessionRepository } from "../ports/out/AppSessionRepository.ts";
import { CacheInvalidator } from "../ports/out/CacheInvalidator.ts";
import { TimeProvider } from "../ports/out/TimeProvider.ts";
import { IdentifierGenerator } from "../ports/out/IdentifierGenerator.ts";
import { TimerService } from "../ports/out/TimerService.ts";

export class AppSessionUseCases {
  constructor(
    private readonly repository: AppSessionRepository,
    private readonly cacheInvalidator: CacheInvalidator,
    private readonly timeProvider: TimeProvider,
    private readonly idGenerator: IdentifierGenerator,
    private readonly timerService: TimerService,
    private readonly ttlMs: number,
    private readonly maxDurationMs: number,
  ) {}

  private handleExpiration = (appSessionId: string) => {
    const session = this.repository.findById(appSessionId);
    if (!session) return;
    
    if (session.isExpired(this.timeProvider.now())) {
      this.timerService.cancelExpiration(appSessionId);
      this.repository.delete(appSessionId);
      this.cacheInvalidator.invalidateAppSession(appSessionId).catch((error) => {
        console.error(
          "[AppSessionUseCases] Falha ao invalidar cache remoto da app session:",
          error,
        );
      });
    }
  };

  private scheduleSessionExpiration(session: AppSession) {
    const delay = session.expiresAt - this.timeProvider.now();
    this.timerService.scheduleExpiration(session.id, delay, this.handleExpiration);
  }

  private expireSession(appSessionId: string) {
    this.timerService.cancelExpiration(appSessionId);
    this.repository.delete(appSessionId);
    this.cacheInvalidator.invalidateAppSession(appSessionId).catch((error) => {
      console.error(
        "[AppSessionUseCases] Falha ao invalidar cache remoto da app session:",
        error,
      );
    });
  }

  register(accountId: string, documentId: string): AppSession {
    const id = this.idGenerator.generateId();
    const now = this.timeProvider.now();
    const session = AppSession.create(id, accountId, documentId, now, this.ttlMs, this.maxDurationMs);
    
    this.repository.save(session);
    this.scheduleSessionExpiration(session);
    return session;
  }

  validate(appSessionId: string, accountId: string): AppSession | null {
    const session = this.repository.findById(appSessionId);
    if (!session || session.accountId !== accountId) return null;

    if (session.isExpired(this.timeProvider.now())) {
      this.expireSession(appSessionId);
      return null;
    }
    return session;
  }

  heartbeat(appSessionId: string, accountId: string): AppSession | null {
    const session = this.validate(appSessionId, accountId);
    if (!session) return null;

    this.timerService.cancelExpiration(appSessionId);
    session.heartbeat(this.timeProvider.now(), this.ttlMs);
    this.repository.save(session);
    this.scheduleSessionExpiration(session);
    return session;
  }

  close(appSessionId: string, accountId: string): void {
    const session = this.repository.findById(appSessionId);
    if (!session || session.accountId !== accountId) return;
    this.expireSession(appSessionId);
  }
}
