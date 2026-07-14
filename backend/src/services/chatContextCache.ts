import type { ChatHistoryEntry } from "../routes/chat.routes.ts";

// M4.5: sem isto, cada mensagem de uma sessão de chat reenvia o histórico
// INTEIRO da conversa pro provedor — numa sessão perto do limite de
// WING_CHAT_MAX_MESSAGES, isso significa repetir dezenas de turnos antigos
// a cada pergunta nova, inflando custo e latência sem agregar contexto
// proporcional. Mantém os últimos N turnos brutos (mais relevantes pra
// continuidade imediata) e comprime o resto num resumo compacto e
// determinístico — sem chamada extra de IA, então é rápido, grátis e
// 100% testável sem rede.
export const DEFAULT_CONTEXT_WINDOW_ENTRIES = 10; // 5 pares pergunta/resposta

const SUMMARY_ENTRY_MAX_CHARS = 480;
const TURN_MAX_CHARS = 70;

const extractText = (entry: ChatHistoryEntry): string =>
  entry.parts.map((part) => part.text).join(" ").trim();

const truncate = (text: string, maxChars: number): string =>
  text.length > maxChars ? `${text.slice(0, maxChars).trimEnd()}…` : text;

// Resumo compacto e determinístico: uma linha por turno (pergunta OU
// resposta), truncada, na ordem original — preserva os dois lados da
// conversa. Só perguntas não bastam: decisões, fatos e respostas que o
// modelo já deu (ex: "o prazo é X", "a cláusula Y significa Z") são
// exatamente o que uma pergunta seguinte tende a depender, e resumir só o
// lado do usuário jogava tudo isso fora.
const summarizeEntries = (entries: ChatHistoryEntry[]): string => {
  const lines = entries.map((entry) => {
    const prefix = entry.role === "user" ? "P" : "R";
    return `${prefix}: ${truncate(extractText(entry), TURN_MAX_CHARS)}`;
  });

  return truncate(
    `[Resumo de ${entries.length} turno(s) anteriores nesta conversa]\n${lines.join("\n")}`,
    SUMMARY_ENTRY_MAX_CHARS,
  );
};

// Retorna o histórico a enviar pro provedor nesta chamada — não modifica
// (nem persiste) o histórico bruto da sessão, que continua completo pra
// auditoria/restauração. Recomputado a cada turno a partir da fonte da
// verdade, então nunca perde informação de forma acumulativa.
export const compactHistory = (
  history: ChatHistoryEntry[],
  windowEntries: number = DEFAULT_CONTEXT_WINDOW_ENTRIES,
): ChatHistoryEntry[] => {
  if (history.length <= windowEntries) return history;

  const compactedCount = history.length - windowEntries;
  const older = history.slice(0, compactedCount);
  const recent = history.slice(compactedCount);

  const summaryEntries: ChatHistoryEntry[] = [
    { role: "user", parts: [{ text: summarizeEntries(older) }] },
    { role: "model", parts: [{ text: "Entendido, vou considerar esse contexto." }] },
  ];

  return [...summaryEntries, ...recent];
};
