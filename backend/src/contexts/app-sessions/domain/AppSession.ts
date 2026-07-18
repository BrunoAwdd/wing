export class AppSession {
  private constructor(
    public readonly id: string,
    public readonly accountId: string,
    public readonly documentId: string,
    public readonly createdAt: number,
    private _lastHeartbeatAt: number,
    private _expiresAt: number,
    public readonly absoluteExpiresAt: number,
  ) {}

  static create(id: string, accountId: string, documentId: string, now: number, ttlMs: number, maxDurationMs: number): AppSession {
    const absoluteExpiresAt = now + maxDurationMs;
    const expiresAt = Math.min(now + ttlMs, absoluteExpiresAt);
    return new AppSession(id, accountId, documentId, now, now, expiresAt, absoluteExpiresAt);
  }

  get lastHeartbeatAt(): number { return this._lastHeartbeatAt; }
  get expiresAt(): number { return this._expiresAt; }

  isExpired(now: number): boolean {
    return this._expiresAt <= now || this.absoluteExpiresAt <= now;
  }

  heartbeat(now: number, ttlMs: number): void {
    if (this.isExpired(now)) {
      throw new Error("Cannot heartbeat an expired session");
    }
    this._lastHeartbeatAt = now;
    this._expiresAt = Math.min(now + ttlMs, this.absoluteExpiresAt);
  }
}
