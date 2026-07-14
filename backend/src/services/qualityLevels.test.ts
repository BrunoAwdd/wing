import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  DEFAULT_QUALITY_LEVEL,
  isQualityLevelAllowedForPlan,
  isSelectableQualityLevel,
  resolveAuthorizedQualityLevel,
  resolveQualityLevelModel,
} from "./qualityLevels.ts";

Deno.test("qualityLevels: mapeia cada nível selecionável pro modelo correto", () => {
  assertEquals(resolveQualityLevelModel("rapido"), "gpt-5.6-luna");
  assertEquals(resolveQualityLevelModel("equilibrado"), "gpt-5.6-terra");
  assertEquals(resolveQualityLevelModel("profundo"), "claude-sonnet-5");
});

Deno.test("qualityLevels: 'maximo' não é selecionável neste ciclo (cai pro padrão)", () => {
  assertEquals(isSelectableQualityLevel("maximo"), false);
  assertEquals(resolveQualityLevelModel("maximo"), resolveQualityLevelModel(DEFAULT_QUALITY_LEVEL));
});

Deno.test("qualityLevels: nível ausente, inválido ou de tipo errado cai pro padrão Equilibrado", () => {
  assertEquals(resolveQualityLevelModel(undefined), "gpt-5.6-terra");
  assertEquals(resolveQualityLevelModel("nivel-inventado"), "gpt-5.6-terra");
  assertEquals(resolveQualityLevelModel(123), "gpt-5.6-terra");
  assertEquals(resolveQualityLevelModel(null), "gpt-5.6-terra");
});

Deno.test("qualityLevels: um cliente não consegue passar um modelo arbitrário via nível", () => {
  assertEquals(resolveQualityLevelModel("claude-opus-4.8"), "gpt-5.6-terra");
  assertEquals(resolveQualityLevelModel("gpt-4"), "gpt-5.6-terra");
});

Deno.test("qualityLevels: 'profundo' exige plano pago; 'rapido'/'equilibrado' são livres", () => {
  assertEquals(isQualityLevelAllowedForPlan("rapido", "free"), true);
  assertEquals(isQualityLevelAllowedForPlan("equilibrado", "free"), true);
  assertEquals(isQualityLevelAllowedForPlan("profundo", "free"), false);
  assertEquals(isQualityLevelAllowedForPlan("profundo", "pro"), true);
  assertEquals(isQualityLevelAllowedForPlan("profundo", "team"), true);
  assertEquals(isQualityLevelAllowedForPlan("profundo", "enterprise"), true);
});

Deno.test("qualityLevels: resolveAuthorizedQualityLevel rebaixa pro padrão quando o plano não autoriza", () => {
  assertEquals(resolveAuthorizedQualityLevel("profundo", "free"), DEFAULT_QUALITY_LEVEL);
  assertEquals(resolveAuthorizedQualityLevel("profundo", "pro"), "profundo");
  assertEquals(resolveAuthorizedQualityLevel("rapido", "free"), "rapido");
});
