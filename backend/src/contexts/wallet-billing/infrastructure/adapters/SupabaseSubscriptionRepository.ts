import { supabase } from "../../../../services/supabaseClient.ts";
import { Subscription, SubscriptionRepository } from "../../application/ports/out/SubscriptionRepository.ts";

export class SupabaseSubscriptionRepository implements SubscriptionRepository {
  async upsert(subscription: Partial<Subscription>): Promise<void> {
    const { data: existing } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("external_subscription_id", subscription.external_subscription_id)
      .single();

    if (existing) {
      const { error } = await supabase
        .from("subscriptions")
        .update(subscription)
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("subscriptions")
        .insert(subscription);
      if (error) throw error;
    }
  }

  async getActiveByAccountId(accountId: string): Promise<Subscription | null> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("account_id", accountId)
      .eq("status", "active") // Only active for now
      .single();

    if (error && error.code !== "PGRST116") throw error; // Ignore not found
    return data as Subscription | null;
  }

  async findByAccountId(
    accountId: string,
  ): Promise<Pick<Subscription, "plan" | "status" | "current_period_end"> | null> {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan, status, current_period_end")
      .eq("account_id", accountId)
      .maybeSingle();

    if (error) throw error;
    return data;
  }
}
