const CHARS_PER_TOKEN = 4;

export interface CreditRate {
  inputPerThousandTokens: number;
  outputPerThousandTokens: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  // M4.7: tokens do prefixo estável que vieram do cache do provedor
  // (leitura — desconto) e tokens gravados no cache nesta chamada (escrita
  // — tarifa normal de entrada, não é "de graça"). Ambos são um
  // subconjunto ADITIVO do total lógico de entrada (`inputTokens` já os
  // inclui, não são somados por cima) e nunca se sobrepõem entre si.
  // Default 0 mantém os chamadores que não usam cache (fix/translate/
  // summarize/rewrite) funcionando sem qualquer mudança de comportamento.
  cachedInputTokens?: number;
  cacheWriteTokens?: number;
}

export interface CreditCharge extends TokenUsage {
  credits: number;
  model: string;
  // Créditos que a conta deixou de pagar por causa do desconto de leitura
  // de cache — 0 quando não há cache envolvido. Existe pra dar prova de
  // economia real na telemetria, não só a contagem de tokens.
  creditsSaved: number;
}

const MODEL_RATES: Array<{
  matches: (model: string) => boolean;
  rate: CreditRate;
}> = [
  {
    matches: (model) =>
      model.includes("gemini") &&
      model.includes("3.1") &&
      model.includes("flash-lite"),
    rate: { inputPerThousandTokens: 1, outputPerThousandTokens: 2 },
  },
  {
    matches: (model) =>
      model.includes("gemini") &&
      model.includes("flash") &&
      !model.includes("flash-lite"),
    rate: { inputPerThousandTokens: 4, outputPerThousandTokens: 24 },
  },
  {
    matches: (model) =>
      model.includes("gpt") && model.includes("5.4") && model.includes("nano"),
    rate: { inputPerThousandTokens: 1, outputPerThousandTokens: 2 },
  },
  {
    matches: (model) =>
      model.includes("gpt") &&
      model.includes("5.6") &&
      (model.includes("luna") || model.includes("lua")),
    rate: { inputPerThousandTokens: 3, outputPerThousandTokens: 15 },
  },
  {
    matches: (model) =>
      model.includes("gpt") && model.includes("5.6") && model.includes("terra"),
    rate: { inputPerThousandTokens: 7, outputPerThousandTokens: 38 },
  },
  {
    matches: (model) =>
      model.includes("gpt") && model.includes("5.6") && model.includes("sol"),
    rate: { inputPerThousandTokens: 13, outputPerThousandTokens: 75 },
  },
  {
    matches: (model) => model.includes("claude") && model.includes("fable"),
    rate: { inputPerThousandTokens: 25, outputPerThousandTokens: 125 },
  },
  {
    matches: (model) => model.includes("claude") && model.includes("haiku"),
    rate: { inputPerThousandTokens: 3, outputPerThousandTokens: 13 },
  },
  {
    matches: (model) =>
      model.includes("claude") &&
      model.includes("sonnet") &&
      model.includes("5"),
    rate: { inputPerThousandTokens: 8, outputPerThousandTokens: 38 },
  },
  {
    matches: (model) =>
      model.includes("claude") &&
      model.includes("opus") &&
      model.includes("4.8"),
    rate: { inputPerThousandTokens: 13, outputPerThousandTokens: 63 },
  },
];

const UNKNOWN_MODEL_RATE: CreditRate = {
  inputPerThousandTokens: 8,
  outputPerThousandTokens: 32,
};

export const estimateTokens = (text: string): number =>
  text.length === 0 ? 0 : Math.ceil(text.length / CHARS_PER_TOKEN);

export const resolveBillableModel = (model?: string): string =>
  model?.trim().toLowerCase() || "gemini-flash-3.5";

export const resolveActionModel = (
  actionName: string,
  requestedModel?: string,
  defaultModel?: string,
  translationModel = Deno.env.get("WING_TRANSLATION_MODEL") ||
    "gemini-3.1-flash-lite",
): string =>
  resolveBillableModel(
    actionName === "translate"
      ? translationModel
      : (requestedModel ?? defaultModel),
  );

export const getCreditRate = (model: string): CreditRate =>
  MODEL_RATES.find((entry) => entry.matches(model))?.rate ?? UNKNOWN_MODEL_RATE;

// M4.7 — hipótese comercial inicial do roadmap: "cobrar 50% da tarifa de
// entrada sobre tokens efetivamente recuperados do cache, manter saída e
// escrita de cache na tarifa normal". Escrita de cache não é desconto — é
// processamento real que o provedor faz, cobrado como entrada comum;
// leitura de cache é o único lado que já sai mais barato pro provedor,
// então é o único lado com desconto pra conta.
const CACHE_READ_DISCOUNT_RATIO = 0.5;

export const calculateCreditCharge = (
  model: string,
  usage: TokenUsage,
): CreditCharge => {
  const rate = getCreditRate(model);
  const cachedInputTokens = usage.cachedInputTokens ?? 0;
  const cacheWriteTokens = usage.cacheWriteTokens ?? 0;
  // `inputTokens` é o total lógico do prompt (documento + histórico +
  // mensagem) — os tokens cacheados/gravados já estão incluídos nesse
  // total, não são um extra por cima. A parte cobrada à tarifa cheia é o
  // restante depois de tirar os dois.
  const uncachedInputTokens = Math.max(
    0,
    usage.inputTokens - cachedInputTokens - cacheWriteTokens,
  );

  // Frações mantidas até o fim, arredondando só o TOTAL — arredondar cada
  // categoria (entrada normal, escrita, leitura cacheada, saída) separada
  // ANTES de somar inflava fragmentos pequenos: quatro pedaços de ~0.8
  // créditos cada viravam 4 créditos cheios (1+1+1+1), quando o total
  // certo (soma das frações, depois um único ceil) é 1.
  const uncachedInputCreditsFraction =
    (uncachedInputTokens * rate.inputPerThousandTokens) / 1_000;
  const cacheWriteCreditsFraction =
    (cacheWriteTokens * rate.inputPerThousandTokens) / 1_000;
  const cachedInputFullPriceFraction =
    (cachedInputTokens * rate.inputPerThousandTokens) / 1_000;
  const cachedInputCreditsFraction = cachedInputFullPriceFraction *
    CACHE_READ_DISCOUNT_RATIO;
  const outputCreditsFraction =
    (usage.outputTokens * rate.outputPerThousandTokens) / 1_000;

  const totalCreditsFraction = uncachedInputCreditsFraction +
    cacheWriteCreditsFraction + cachedInputCreditsFraction +
    outputCreditsFraction;

  // creditsSaved precisa refletir a diferença entre os dois valores JÁ
  // arredondados do jeito que a carteira de fato cobra (um único ceil no
  // total) — não a diferença das frações cruas antes de arredondar. Com
  // outras categorias no mesmo pedido, arredondar só a fração cacheada
  // podia divergir do que a carteira realmente deixou de cobrar (ex:
  // fração cacheada de 0.4 arredondava pra "economia 0", mas o total real
  // caiu de 7 créditos pra 6 por causa do cache — a economia de verdade era
  // 1, não 0).
  const fullPriceTotalFraction = uncachedInputCreditsFraction +
    cacheWriteCreditsFraction + cachedInputFullPriceFraction +
    outputCreditsFraction;
  const chargedCredits = Math.max(1, Math.ceil(totalCreditsFraction));

  return {
    ...usage,
    credits: chargedCredits,
    creditsSaved: Math.max(
      0,
      Math.ceil(fullPriceTotalFraction) - Math.ceil(totalCreditsFraction),
    ),
    model,
  };
};

// M4.7: no momento da reserva (antes de chamar a IA), ainda não se sabe se
// vai haver cache hit — reservar sempre pela tarifa cheia (sem assumir
// desconto) é o lado seguro, nunca sub-reserva. `cacheUsage` só é passado
// de verdade na liquidação, depois que o provedor confirma o que realmente
// veio do cache.
// M4.7: `totalInputTokens`, quando o provedor devolve essa contagem real
// nos metadados de uso da chamada, substitui a estimativa por tamanho de
// texto na liquidação — sem isso, mesmo com a repartição de cache real
// (`cachedInputTokens`/`cacheWriteTokens`), o total de entrada cobrado
// continuava sendo só um palpite. `undefined` (provedor não devolveu) cai
// de volta pra `estimateTokens`, mesmo comportamento de antes.
type CacheUsageOverride =
  & Pick<TokenUsage, "cachedInputTokens" | "cacheWriteTokens">
  & { totalInputTokens?: number };

export const estimateActionCharge = (
  prompt: string,
  model: string,
  outputTokens: number,
  cacheUsage: CacheUsageOverride = {},
): CreditCharge => {
  const { totalInputTokens, ...tokenUsage } = cacheUsage;
  return calculateCreditCharge(model, {
    inputTokens: totalInputTokens ?? estimateTokens(prompt),
    outputTokens,
    ...tokenUsage,
  });
};

export const estimateChatCharge = (
  message: string,
  history: Array<{ parts?: Array<{ text?: string }> }>,
  model: string,
  outputTokens: number,
  cacheUsage: CacheUsageOverride = {},
): CreditCharge => {
  const historyText = history
    .flatMap((entry) => entry.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n");
  return estimateActionCharge(
    `${historyText}\n${message}`,
    model,
    outputTokens,
    cacheUsage,
  );
};
