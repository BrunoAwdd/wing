import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isProviderAvailable, resolveAvailableModel } from "./aiService.ts";
import { resolveActionExecutionModel } from "./requestHandler.ts";

const environment = (values: Record<string, string | undefined>) => ({
  get: (name: string) => values[name],
});

Deno.test("provider availability: bloqueia GPT/Claude sem chave e mantém Gemini disponível", () => {
  const emptyEnvironment = environment({});
  assertEquals(isProviderAvailable("gpt-5.6-terra", emptyEnvironment), false);
  assertEquals(
    isProviderAvailable("claude-sonnet-5", emptyEnvironment),
    false,
  );
  assertEquals(
    isProviderAvailable("gemini-flash-3.5", emptyEnvironment),
    true,
  );
  assertEquals(
    isProviderAvailable(
      "gpt-5.6-terra",
      environment({ OPENAI_API_KEY: "configured" }),
    ),
    true,
  );
});

Deno.test("provider availability: usa Gemini como fallback somente em desenvolvimento", () => {
  const emptyEnvironment = environment({});
  assertEquals(
    resolveAvailableModel(
      "gpt-5.6-terra",
      "gemini-flash-3.5",
      false,
      (model) => isProviderAvailable(model, emptyEnvironment),
    ),
    "gemini-flash-3.5",
  );
  assertEquals(
    resolveAvailableModel(
      "gpt-5.6-terra",
      "gemini-flash-3.5",
      true,
      (model) => isProviderAvailable(model, emptyEnvironment),
    ),
    "gpt-5.6-terra",
  );
});

const defaults = {
  generalModel: "gemini-flash-3.5",
  translationModel: "gemini-3.1-flash-lite",
};

Deno.test(
  "Quick Model: /fix ignora modelo arbitrário enviado pelo cliente",
  () => {
    assertEquals(
      resolveActionExecutionModel("fix", { model: "claude-fable" }, defaults),
      "gemini-flash-3.5",
    );
  },
);

Deno.test(
  "Quick Model: /summarize ignora modelo arbitrário enviado pelo cliente",
  () => {
    assertEquals(
      resolveActionExecutionModel(
        "summarize",
        { model: "claude-opus-4.8" },
        defaults,
      ),
      "gemini-flash-3.5",
    );
  },
);

Deno.test("Quick Model: tradução e reescrita só usam rotas autorizadas", () => {
  assertEquals(
    resolveActionExecutionModel(
      "translate",
      { model: "claude-fable" },
      defaults,
    ),
    "gemini-3.1-flash-lite",
  );
  assertEquals(
    resolveActionExecutionModel(
      "rewrite",
      { model: "claude-fable", qualityLevel: "profundo" },
      defaults,
    ),
    "claude-sonnet-5",
  );
  assertEquals(
    resolveActionExecutionModel(
      "rewrite",
      { model: "claude-fable", qualityLevel: "maximo" },
      defaults,
    ),
    "gpt-5.6-terra",
  );
});
