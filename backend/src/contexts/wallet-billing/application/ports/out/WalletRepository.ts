export interface ReservationResult {
  reservationId: string;
  creditsUsed: number;
  allowed: boolean;
}

export interface TrialReservationResult extends ReservationResult {
  // Distingue "sem crédito" de "prazo do teste esgotado" — quem chama
  // decide se devolve uma mensagem de upgrade diferente pra cada caso.
  trialExpired: boolean;
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
  // Concessão única de créditos de teste grátis (não-mensal — ver migration
  // 20260717120000_add_trial_credits.sql). `trialDurationSeconds` conta a
  // partir de accounts.created_at.
  reserveTrialCredits(
    accountId: string,
    model: string,
    credits: number,
    limit: number,
    trialDurationSeconds: number,
  ): Promise<TrialReservationResult>;
  settleTrialCredits(reservationId: string, charge: Charge): Promise<number>;
}
