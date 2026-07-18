// Plano de roteamento de modelos: o cliente nunca escolhe um modelo por
// nome — só um nível de qualidade. O mapeamento nível -> modelo real fica
// inteiramente aqui, no backend: não expõe nomes/tarifas de modelo pro
// front, e permite trocar o modelo por trás de um nível sem depender de um
// novo deploy do add-in.
export type QualityLevel = "rapido" | "equilibrado" | "profundo" | "maximo";

const QUALITY_LEVEL_MODELS: Record<QualityLevel, string> = {
  rapido: "gpt-5.6-luna",
  equilibrado: "gpt-5.6-terra",
  profundo: "claude-sonnet-5",
  maximo: "gpt-5.6-sol",
};

// "Máximo" fica fora de seleção pública neste ciclo (QUICK_MODEL_ROUTING_PLAN
// §"Fora deste ciclo": "liberação pública do nível Máximo"). Continua
// mapeado acima pra reativar sem migração quando chegar a hora.
const SELECTABLE_QUALITY_LEVELS: readonly QualityLevel[] = [
  "rapido",
  "equilibrado",
  "profundo",
];

export const DEFAULT_QUALITY_LEVEL: QualityLevel = "equilibrado";

export const isSelectableQualityLevel = (
  value: unknown,
): value is QualityLevel =>
  typeof value === "string" &&
  (SELECTABLE_QUALITY_LEVELS as readonly string[]).includes(value);

// "Profundo" (o modelo mais caro selecionável) exige plano pago — ter
// créditos suficientes não é suficiente pra liberar; sem essa checagem, uma
// conta Free que acumulou/comprou créditos usaria o mesmo modelo caro que o
// plano Pro paga por assinatura, sem nenhuma autorização de plano.
const QUALITY_LEVEL_MIN_PLAN: Record<QualityLevel, "free" | "pro"> = {
  rapido: "free",
  equilibrado: "free",
  profundo: "pro",
  maximo: "pro",
};

const PLAN_RANK: Record<string, number> = {
  free: 0,
  basic: 1,
  pro: 2,
  team: 2,
  enterprise: 2,
};

export const isQualityLevelAllowedForPlan = (
  level: QualityLevel,
  plan: string,
): boolean =>
  (PLAN_RANK[plan] ?? 0) >= PLAN_RANK[QUALITY_LEVEL_MIN_PLAN[level]];

// Nível efetivamente autorizado pra essa conta: nível desconhecido ou
// "maximo" (ainda não liberado publicamente) cai pro padrão; nível
// selecionável mas não autorizado pro plano da conta também cai pro
// padrão — nunca lança exceção aqui, quem chama decide se quer bloquear a
// operação ou seguir com o nível rebaixado.
export const resolveAuthorizedQualityLevel = (
  level: unknown,
  plan: string,
): QualityLevel => {
  if (!isSelectableQualityLevel(level)) return DEFAULT_QUALITY_LEVEL;
  return isQualityLevelAllowedForPlan(level, plan) ? level : DEFAULT_QUALITY_LEVEL;
};

// Nunca deixa o cliente alcançar um modelo arbitrário: nível desconhecido ou
// "maximo" (ainda não liberado publicamente) cai pro padrão Equilibrado.
export const resolveQualityLevelModel = (level: unknown): string =>
  QUALITY_LEVEL_MODELS[
    isSelectableQualityLevel(level) ? level : DEFAULT_QUALITY_LEVEL
  ];
