export interface CacheInvalidator {
  invalidateAppSession(appSessionId: string): Promise<void>;
}
