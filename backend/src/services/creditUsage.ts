const CHARS_PER_TOKEN = 4;

export interface CreditRate {
  inputPerThousandTokens: number;
  outputPerThousandTokens: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CreditCharge extends TokenUsage {
  credits: number;
  model: string;
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

export const calculateCreditCharge = (
  model: string,
  usage: TokenUsage,
): CreditCharge => {
  const rate = getCreditRate(model);
  const inputCredits = Math.ceil(
    (usage.inputTokens * rate.inputPerThousandTokens) / 1_000,
  );
  const outputCredits = Math.ceil(
    (usage.outputTokens * rate.outputPerThousandTokens) / 1_000,
  );
  return {
    ...usage,
    credits: Math.max(1, inputCredits + outputCredits),
    model,
  };
};

export const estimateActionCharge = (
  prompt: string,
  model: string,
  outputTokens: number,
): CreditCharge =>
  calculateCreditCharge(model, {
    inputTokens: estimateTokens(prompt),
    outputTokens,
  });

export const estimateChatCharge = (
  message: string,
  history: Array<{ parts?: Array<{ text?: string }> }>,
  model: string,
  outputTokens: number,
): CreditCharge => {
  const historyText = history
    .flatMap((entry) => entry.parts ?? [])
    .map((part) => part.text ?? "")
    .join("\n");
  return estimateActionCharge(
    `${historyText}\n${message}`,
    model,
    outputTokens,
  );
};
