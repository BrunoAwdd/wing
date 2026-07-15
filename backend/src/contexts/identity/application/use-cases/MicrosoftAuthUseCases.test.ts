import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MicrosoftAuthUseCases } from "./MicrosoftAuthUseCases.ts";

Deno.test("MicrosoftAuthUseCases.authenticateWithMicrosoft: emite sessão com portas reais (sem 'as any')", async () => {
  const events: string[] = [];
  const useCases = new MicrosoftAuthUseCases(
    { validate: async () => ({ objectId: "obj-1", tenantId: "tenant-1", email: "a@b.com", displayName: "Ana" }) },
    { issueSession: async () => ({ token: "tok", expiresAt: "2026-01-01T00:00:00Z" }) },
    {
      getOrCreateFromMicrosoft: async () => ({ id: "acc-1", email: "a@b.com", display_name: null }),
      getPlan: async () => "pro",
    },
    { trackEvent: (eventName) => events.push(eventName) },
  );

  const response = await useCases.authenticateWithMicrosoft("access-token");

  assertEquals(response.token, "tok");
  assertEquals(response.user, { email: "a@b.com", displayName: "Ana", plan: "pro" });
  assertEquals(events, ["office_sso_success"]);
});
