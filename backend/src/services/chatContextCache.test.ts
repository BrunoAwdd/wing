import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { compactHistory } from "./chatContextCache.ts";
import type { ChatHistoryEntry } from "../routes/chat.routes.ts";

const entry = (role: "user" | "model", text: string): ChatHistoryEntry => ({
  role,
  parts: [{ text }],
});

Deno.test("compactHistory: histórico dentro da janela não é alterado", () => {
  const history = [entry("user", "oi"), entry("model", "olá")];
  assertEquals(compactHistory(history, 10), history);
});

Deno.test("compactHistory: histórico maior que a janela vira resumo + últimos turnos brutos", () => {
  const history: ChatHistoryEntry[] = [];
  for (let i = 0; i < 20; i += 1) {
    history.push(entry("user", `pergunta ${i}`));
    history.push(entry("model", `resposta ${i}`));
  }

  const compacted = compactHistory(history, 6);

  // 2 entradas de resumo + as últimas 6 brutas
  assertEquals(compacted.length, 8);
  assertEquals(compacted[0].role, "user");
  assert(compacted[0].parts[0].text.includes("Resumo de"));
  assertEquals(compacted[1].role, "model");
  // últimas 6 entradas brutas preservadas exatamente (últimos 3 pares)
  assertEquals(compacted.slice(2), history.slice(-6));
});

Deno.test("compactHistory: nunca modifica o histórico original (a sessão continua com a verdade completa)", () => {
  const history: ChatHistoryEntry[] = [];
  for (let i = 0; i < 20; i += 1) history.push(entry("user", `p${i}`));
  const originalLength = history.length;

  compactHistory(history, 4);

  assertEquals(history.length, originalLength);
});

Deno.test("compactHistory: recomputa do zero a cada chamada (sem perda acumulativa entre turnos)", () => {
  const history: ChatHistoryEntry[] = [];
  for (let i = 0; i < 12; i += 1) history.push(entry("user", `p${i}`));

  const first = compactHistory(history, 4);
  history.push(entry("user", "p12"));
  const second = compactHistory(history, 4);

  // O resumo da segunda chamada reflete uma pergunta a mais que a primeira.
  assert(first[0].parts[0].text !== second[0].parts[0].text);
});

Deno.test("compactHistory: o resumo preserva respostas do modelo, não só perguntas do usuário", () => {
  const history: ChatHistoryEntry[] = [];
  for (let i = 0; i < 20; i += 1) {
    history.push(entry("user", `pergunta ${i}`));
    // Resposta com um fato que uma pergunta seguinte poderia depender.
    history.push(entry("model", `o prazo da cláusula ${i} é 30 dias`));
  }

  const compacted = compactHistory(history, 6);
  const summaryText = compacted[0].parts[0].text;

  assert(summaryText.includes("pergunta 0"));
  assert(summaryText.includes("prazo da cláusula 0"));
});
