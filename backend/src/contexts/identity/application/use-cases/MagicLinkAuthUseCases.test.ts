import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { MagicLinkAuthUseCases } from "./MagicLinkAuthUseCases.ts";

const buildUseCases = () => {
  const revoked: string[] = [];
  const useCases = new MagicLinkAuthUseCases(
    {
      requestCode: async () => {},
      verifyCode: async (email) => ({ email }),
    },
    { issueSession: async ({ accountId }) => ({ token: `tok-${accountId}`, expiresAt: "2026-01-01T00:00:00Z" }) },
    {
      issueRefreshToken: async (accountId) => ({ token: `refresh-${accountId}`, expiresAt: "2026-02-01T00:00:00Z" }),
      consumeRefreshToken: async () => "acc-1",
      revokeRefreshToken: async (token) => {
        revoked.push(token);
      },
    },
    {
      getOrCreateFromEmail: async (email) => ({ id: "acc-1", email, display_name: null }),
      getAccount: async (id) => ({ id, email: "a@b.com", display_name: null }),
      getPlan: async () => "free",
    },
    { trackEvent: () => {} },
  );
  return { useCases, revoked };
};

Deno.test("MagicLinkAuthUseCases.verifyMagicLink: emite sessão + refresh token com portas reais", async () => {
  const { useCases } = buildUseCases();
  const response = await useCases.verifyMagicLink("a@b.com", "123456");
  assertEquals(response.token, "tok-acc-1");
  assertEquals(response.refreshToken, "refresh-acc-1");
  assertEquals(response.user.plan, "free");
});

Deno.test("MagicLinkAuthUseCases.refreshSession: troca refresh token por nova sessão", async () => {
  const { useCases } = buildUseCases();
  const response = await useCases.refreshSession("old-refresh");
  assertEquals(response.token, "tok-acc-1");
  assertEquals(response.refreshToken, "refresh-acc-1");
});

Deno.test("MagicLinkAuthUseCases.logout: revoga o refresh token informado", async () => {
  const { useCases, revoked } = buildUseCases();
  await useCases.logout("refresh-abc");
  assertEquals(revoked, ["refresh-abc"]);
});

Deno.test("MagicLinkAuthUseCases.logout: sem refresh token não chama a porta", async () => {
  const { useCases, revoked } = buildUseCases();
  await useCases.logout(undefined);
  assertEquals(revoked, []);
});
