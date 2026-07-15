import { supabase } from "../../../../services/supabaseClient.ts";
import { WebhookEventData, WebhookIdempotencyStore } from "../../application/ports/out/WebhookIdempotencyStore.ts";

export class SupabaseWebhookIdempotencyStore implements WebhookIdempotencyStore {
  async recordIfNew(event: WebhookEventData): Promise<boolean> {
    const { error } = await supabase.from("webhook_events").insert({
      id: event.id,
      type: event.type,
      payload: event.payload,
    });
    if (!error) return true;
    if (error.code === "23505") return false;
    throw error;
  }

  async remove(eventId: string): Promise<void> {
    const { error } = await supabase.from("webhook_events").delete().eq(
      "id",
      eventId,
    );
    if (error) throw error;
  }
}
