import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateCreditCharge,
  estimateChatCharge,
  estimateTokens,
  getCreditRate,
  resolveActionModel,
} from "./creditUsage.ts";

Deno.test("credit usage: estima tokens sem cobrar texto vazio", () => {
  assertEquals(estimateTokens(""), 0);
  assertEquals(estimateTokens("12345"), 2);
});

Deno.test("credit usage: modelos diferentes debitam o mesmo pote com pesos diferentes", () => {
  const usage = { inputTokens: 2_000, outputTokens: 1_000 };
  assertEquals(
    calculateCreditCharge("gemini-2.5-flash-lite", usage).credits,
    4,
  );
  assertEquals(calculateCreditCharge("gemini-flash-3.5", usage).credits, 32);
  assertEquals(calculateCreditCharge("gpt-5.6-luna", usage).credits, 21);
  assertEquals(calculateCreditCharge("gpt-5.6-terra", usage).credits, 52);
  assertEquals(calculateCreditCharge("gpt-5.6-sol", usage).credits, 101);
  assertEquals(calculateCreditCharge("claude-haiku", usage).credits, 19);
  assertEquals(calculateCreditCharge("claude-sonnet-5", usage).credits, 54);
  assertEquals(calculateCreditCharge("claude-opus-4.8", usage).credits, 89);
  assertEquals(calculateCreditCharge("claude-fable", usage).credits, 175);
});

Deno.test("credit usage: modelo desconhecido usa tarifa conservadora", () => {
  assertEquals(getCreditRate("future-expensive-model"), {
    inputPerThousandTokens: 8,
    outputPerThousandTokens: 32,
  });
});

Deno.test("credit usage: tradução sempre usa o modelo econômico dedicado", () => {
  assertEquals(
    resolveActionModel(
      "translate",
      "claude-opus-4.8",
      "gemini-flash-3.5",
    ),
    "gemini-2.5-flash-lite",
  );
  assertEquals(
    resolveActionModel("rewrite", "gpt-5.6-terra", "gemini-flash-3.5"),
    "gpt-5.6-terra",
  );
});

Deno.test("credit usage: reserva do chat inclui histórico e saída", () => {
  const charge = estimateChatCharge(
    "1234",
    [{ parts: [{ text: "1234" }] }],
    "gemini-flash-3.5",
    1_000,
  );
  assertEquals(charge.inputTokens, 3);
  assertEquals(charge.outputTokens, 1_000);
  assertEquals(charge.credits, 25);
});
