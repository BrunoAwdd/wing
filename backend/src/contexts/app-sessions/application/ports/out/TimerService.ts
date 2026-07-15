export interface TimerService {
  scheduleExpiration(appSessionId: string, delay: number, onExpire: (id: string) => void): void;
  cancelExpiration(appSessionId: string): void;
}
