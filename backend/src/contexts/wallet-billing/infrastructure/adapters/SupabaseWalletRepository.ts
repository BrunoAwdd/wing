import { supabase } from "../../../../services/supabaseClient.ts";
import { Charge, IncrementResult, ReservationResult, WalletRepository } from "../../application/ports/out/WalletRepository.ts";

export class SupabaseWalletRepository implements WalletRepository {
  async reserveCredits(accountId: string, model: string, credits: number, limit: number | null): Promise<ReservationResult> {
    const now = new Date();
    const yyyymm = Number(
      `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`,
    );
    const reservationId = crypto.randomUUID();
    const { data, error } = await supabase.rpc("reserve_usage_credits", {
      p_reservation_id: reservationId,
      p_account_id: accountId,
      p_yyyymm: yyyymm,
      p_model: model,
      p_credits: credits,
      p_limit: limit,
    });
    if (error) throw error;
    const row = (Array.isArray(data) ? data[0] : data) as {
      credits_used: number;
      allowed: boolean;
    };
    return {
      reservationId,
      creditsUsed: Number(row.credits_used),
      allowed: row.allowed,
    };
  }

  async settleCredits(reservationId: string, charge: Charge): Promise<number> {
    const { data, error } = await supabase.rpc("settle_usage_credits", {
      p_reservation_id: reservationId,
      p_actual_credits: charge.credits,
      p_input_tokens: charge.inputTokens,
      p_output_tokens: charge.outputTokens,
    });
    if (error) throw error;
    return Number(data);
  }

  async incrementUsage(accountId: string, tokens: number, limit: number | null): Promise<IncrementResult> {
    const now = new Date();
    const yyyymm = parseInt(
      `${now.getFullYear()}${(now.getMonth() + 1).toString().padStart(2, "0")}`,
    );

    const { data, error } = await supabase.rpc(
      "increment_usage_and_check_limit",
      {
        p_account_id: accountId,
        p_yyyymm: yyyymm,
        p_tokens: tokens,
        p_limit: limit,
      },
    );
    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as {
      requests_count: number;
      allowed: boolean;
    };

    return { requestsCount: row.requests_count, allowed: row.allowed };
  }
}
