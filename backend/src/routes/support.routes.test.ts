import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Application } from "../deps.ts";
import { createSupportRouter } from "./support.routes.ts";
import type { SupportRequestInput } from "../services/supportRequestService.ts";

const request = async (
  body: Record<string, unknown>,
  create: (input: SupportRequestInput) => Promise<string> = async () =>
    "request-id",
) => {
  const app = new Application();
  const router = createSupportRouter({ create });
  app.use(router.routes());
  return await app.handle(
    new Request("http://localhost/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
};

const validBody = {
  name: "Ana Silva",
  email: "ANA@EXAMPLE.COM",
  category: "support",
  subject: "Não consigo abrir o painel",
  message: "O painel não abre desde hoje pela manhã.",
  privacyAccepted: true,
};

Deno.test("Support: valida e persiste uma solicitação pública", async () => {
  let received: SupportRequestInput | undefined;
  const response = await request(validBody, async (input) => {
    received = input;
    return "abc-123";
  });

  assertEquals(response?.status, 201);
  assertEquals(received, {
    name: "Ana Silva",
    email: "ana@example.com",
    category: "support",
    subject: "Não consigo abrir o painel",
    message: "O painel não abre desde hoje pela manhã.",
  });
});

Deno.test("Support: rejeita formulário incompleto ou sem aceite", async () => {
  const response = await request({ ...validBody, privacyAccepted: false });
  assertEquals(response?.status, 400);
});

Deno.test("Support: honeypot aceita sem persistir", async () => {
  let calls = 0;
  const response = await request(
    { ...validBody, website: "spam.test" },
    async () => {
      calls += 1;
      return "never";
    },
  );
  assertEquals(response?.status, 202);
  assertEquals(calls, 0);
});
