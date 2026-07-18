import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { resolveCorsOrigins } from "./corsConfig.ts";

Deno.test("CORS: desenvolvimento usa apenas os hosts atuais do add-in", () => {
  assertEquals(resolveCorsOrigins(undefined, false), [
    "https://localhost:5173",
    "https://localhost:5174",
    "https://supercontext-ui.atdigitalbank.com.br",
  ]);
});

Deno.test("CORS: produção exige allowlist explícita", () => {
  assertThrows(() => resolveCorsOrigins(undefined, true));
});

Deno.test("CORS: aceita múltiplas origens HTTPS e remove duplicatas", () => {
  assertEquals(
    resolveCorsOrigins(
      "https://app.wing.example, https://app.wing.example",
      true,
    ),
    ["https://app.wing.example"],
  );
});

Deno.test("CORS: rejeita wildcard, null, HTTP e URLs com caminho", () => {
  for (
    const origin of [
      "*",
      "null",
      "http://app.wing.example",
      "https://app.wing.example/path",
    ]
  ) {
    assertThrows(() => resolveCorsOrigins(origin, true));
  }
});

Deno.test("CORS: produção rejeita localhost e o túnel de dev mesmo se vierem na allowlist explícita", () => {
  for (
    const origin of [
      "https://localhost:5173",
      "https://localhost:5174",
      "https://supercontext-ui.atdigitalbank.com.br",
    ]
  ) {
    assertThrows(
      () => resolveCorsOrigins(`https://app.wing.example,${origin}`, true),
    );
  }
});
