import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculateCreditCharge,
  estimateActionCharge,
  estimateChatCharge,
  estimateTokens,
  getCreditRate,
  resolveActionModel,
} from "./creditUsage.ts";

Deno.test("credit usage: estima tokens sem cobrar texto vazio", () => {
  assertEquals(estimateTokens(""), 0);
  assertEquals(estimateTokens("12345"), 2);
});

Deno.test(
  "credit usage: modelos diferentes debitam o mesmo pote com pesos diferentes",
  () => {
    const usage = { inputTokens: 2_000, outputTokens: 1_000 };
    assertEquals(
      calculateCreditCharge("gemini-3.1-flash-lite", usage).credits,
      4,
    );
    assertEquals(calculateCreditCharge("gpt-5.4-nano", usage).credits, 4);
    assertEquals(calculateCreditCharge("gemini-flash-3.5", usage).credits, 32);
    assertEquals(calculateCreditCharge("gpt-5.6-luna", usage).credits, 21);
    assertEquals(calculateCreditCharge("gpt-5.6-terra", usage).credits, 52);
    assertEquals(calculateCreditCharge("gpt-5.6-sol", usage).credits, 101);
    assertEquals(calculateCreditCharge("claude-haiku", usage).credits, 19);
    assertEquals(calculateCreditCharge("claude-sonnet-5", usage).credits, 54);
    assertEquals(calculateCreditCharge("claude-opus-4.8", usage).credits, 89);
    assertEquals(calculateCreditCharge("claude-fable", usage).credits, 175);
  },
);

Deno.test("credit usage: modelo desconhecido usa tarifa conservadora", () => {
  assertEquals(getCreditRate("future-expensive-model"), {
    inputPerThousandTokens: 8,
    outputPerThousandTokens: 32,
  });
});

Deno.test(
  "credit usage: tradução sempre usa o modelo econômico dedicado",
  () => {
    assertEquals(
      resolveActionModel("translate", "claude-opus-4.8", "gemini-flash-3.5"),
      "gemini-3.1-flash-lite",
    );
    assertEquals(
      resolveActionModel("rewrite", "gpt-5.4-nano", "gemini-flash-3.5"),
      "gpt-5.4-nano",
    );
  },
);

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
  assertEquals(charge.creditsSaved, 0);
});

Deno.test("credit usage: leitura de cache é cobrada com 50% de desconto sobre a tarifa de entrada", () => {
  // claude-sonnet-5: inputPerThousandTokens = 8. 2_000 tokens todos vindos
  // do cache -> tarifa cheia seria ceil(2000*8/1000)=16 créditos; com 50%
  // de desconto, ceil(16*0.5)=8.
  const charge = calculateCreditCharge("claude-sonnet-5", {
    inputTokens: 2_000,
    cachedInputTokens: 2_000,
    outputTokens: 0,
  });
  assertEquals(charge.credits, 8);
  assertEquals(charge.creditsSaved, 8);
});

Deno.test("credit usage: escrita de cache é cobrada como entrada normal, sem desconto", () => {
  const withCacheWrite = calculateCreditCharge("claude-sonnet-5", {
    inputTokens: 2_000,
    cacheWriteTokens: 2_000,
    outputTokens: 0,
  });
  const withoutCache = calculateCreditCharge("claude-sonnet-5", {
    inputTokens: 2_000,
    outputTokens: 0,
  });
  // Mesma tarifa cheia nos dois casos — escrita de cache não é desconto.
  assertEquals(withCacheWrite.credits, withoutCache.credits);
  assertEquals(withCacheWrite.creditsSaved, 0);
});

Deno.test("credit usage: tokens cacheados/gravados são subconjunto do total lógico, não somados por cima", () => {
  // 2_000 tokens no total: 500 vieram do cache, 1_500 são novos (tarifa
  // cheia). Sem a subtração, isso cobraria como se fossem 2_500 tokens.
  const charge = calculateCreditCharge("claude-sonnet-5", {
    inputTokens: 2_000,
    cachedInputTokens: 500,
    outputTokens: 0,
  });
  // 1_500 tokens cheios: ceil(1500*8/1000)=12. 500 cacheados com desconto:
  // ceil(ceil(500*8/1000)*0.5)=ceil(4*0.5)=2. Total = 14.
  assertEquals(charge.credits, 14);
  assertEquals(charge.creditsSaved, 2);
});

Deno.test("credit usage: chamadores sem cache (fix/translate/summarize/rewrite) continuam com o comportamento antigo", () => {
  const usage = { inputTokens: 2_000, outputTokens: 1_000 };
  const charge = calculateCreditCharge("claude-sonnet-5", usage);
  assertEquals(charge.credits, 54); // mesmo valor do teste de modelos acima
  assertEquals(charge.creditsSaved, 0);
  assertEquals(charge.cachedInputTokens, undefined);
  assertEquals(charge.cacheWriteTokens, undefined);
});

Deno.test("credit usage: fragmentos pequenos são somados como frações antes de arredondar (não um ceil por categoria)", () => {
  // claude-sonnet-5: inputPerThousandTokens=8, outputPerThousandTokens=38.
  // 100 tokens não-cacheados (0.8 créditos), 100 gravados no cache (0.8),
  // 100 lidos do cache (0.8 cheio -> 0.4 com desconto de 50%), 100 de saída
  // (3.8). Arredondando CADA categoria isoladamente (comportamento antigo):
  // ceil(0.8)=1 + ceil(0.8)=1 + ceil(ceil(0.8)*0.5)=ceil(0.5)=1 + ceil(3.8)=4
  // = 7 créditos. Somando as frações primeiro e arredondando só o total:
  // 0.8+0.8+0.4+3.8=5.8 -> ceil=6. A cobrança certa é 6, não 7.
  const charge = calculateCreditCharge("claude-sonnet-5", {
    inputTokens: 300, // 100 não-cacheados + 100 gravados + 100 cacheados
    cachedInputTokens: 100,
    cacheWriteTokens: 100,
    outputTokens: 100,
  });
  assertEquals(charge.credits, 6);
});

Deno.test("credit usage: creditsSaved reflete a diferença dos totais JÁ arredondados, não da fração cacheada isolada", () => {
  // Mesmo cenário do teste acima: sem cache, o total (sem desconto) seria
  // 0.8+0.8+0.8+3.8=6.2 créditos -> ceil=7. Com desconto, o total real
  // cobrado é 5.8 -> ceil=6. A carteira economizou 7-6=1 crédito de
  // verdade — mas arredondar só a fração cacheada isolada (0.8 cheio ->
  // 0.4 com desconto, diferença 0.4) arredondava pra 0, uma divergência
  // real entre o que a carteira economizou e o que a telemetria registrava.
  const charge = calculateCreditCharge("claude-sonnet-5", {
    inputTokens: 300,
    cachedInputTokens: 100,
    cacheWriteTokens: 100,
    outputTokens: 100,
  });
  assertEquals(charge.credits, 6);
  assertEquals(charge.creditsSaved, 1);
});

Deno.test("credit usage: totalInputTokens real do provedor substitui a estimativa por tamanho de texto", () => {
  // Um prompt curtíssimo (estimativa ~poucos tokens) mas o provedor
  // reporta um total de entrada bem maior (ex: histórico/instruções
  // reais processadas) — sem o override, a liquidação cobraria pela
  // estimativa errada, não pelo consumo real.
  const withRealCount = estimateActionCharge("oi", "claude-sonnet-5", 0, {
    totalInputTokens: 5_000,
  });
  const withEstimate = estimateActionCharge("oi", "claude-sonnet-5", 0, {});

  assertEquals(withRealCount.inputTokens, 5_000);
  assertEquals(withEstimate.inputTokens, estimateTokens("oi"));
  assertEquals(withRealCount.credits > withEstimate.credits, true);
});
