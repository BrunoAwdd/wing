import { WalletRepository } from "../ports/out/WalletRepository.ts";

export class WalletUseCases {
  constructor(private readonly walletRepository: WalletRepository) {}

  async reserveCredits(accountId: string, model: string, credits: number, limit: number | null) {
    return this.walletRepository.reserveCredits(accountId, model, credits, limit);
  }

  async settleCredits(reservationId: string, credits: number, inputTokens: number, outputTokens: number) {
    return this.walletRepository.settleCredits(reservationId, { credits, inputTokens, outputTokens });
  }

  async incrementUsage(accountId: string, tokens: number, limit: number | null) {
    return this.walletRepository.incrementUsage(accountId, tokens, limit);
  }

  async reserveTrialCredits(
    accountId: string,
    model: string,
    credits: number,
    limit: number,
    trialDurationSeconds: number,
  ) {
    return this.walletRepository.reserveTrialCredits(accountId, model, credits, limit, trialDurationSeconds);
  }

  async settleTrialCredits(reservationId: string, credits: number, inputTokens: number, outputTokens: number) {
    return this.walletRepository.settleTrialCredits(reservationId, { credits, inputTokens, outputTokens });
  }
}
