import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveActionExecutionModel } from "./requestHandler.ts";

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
