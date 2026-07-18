import { supabase } from "./supabaseClient.ts";

export type SupportRequestCategory =
  | "support"
  | "commercial"
  | "privacy"
  | "billing"
  | "other";

export interface SupportRequestInput {
  name: string;
  email: string;
  category: SupportRequestCategory;
  subject: string;
  message: string;
}

export const supportRequestService = {
  async create(input: SupportRequestInput): Promise<string> {
    const id = crypto.randomUUID();
    const { error } = await supabase.from("support_requests").insert({
      id,
      name: input.name,
      email: input.email,
      category: input.category,
      subject: input.subject,
      message: input.message,
    });

    if (error) {
      throw new Error(`Falha ao registrar solicitação: ${error.message}`);
    }
    return id;
  },
};
