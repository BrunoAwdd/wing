export interface WebhookEventData {
  id: string;
  type: string;
}

export interface WebhookIdempotencyStore {
  recordIfNew(event: WebhookEventData): Promise<boolean>;
  remove(eventId: string): Promise<void>;
}
