export interface ReservationResult {
  reservationId: string;
  creditsUsed: number;
  allowed: boolean;
}

export interface IncrementResult {
  requestsCount: number;
  allowed: boolean;
}

export interface Charge {
  credits: number;
  inputTokens: number;
  outputTokens: number;
}

export interface WalletRepository {
  reserveCredits(accountId: string, model: string, credits: number, limit: number | null): Promise<ReservationResult>;
  settleCredits(reservationId: string, charge: Charge): Promise<number>;
  incrementUsage(accountId: string, tokens: number, limit: number | null): Promise<IncrementResult>;
}
