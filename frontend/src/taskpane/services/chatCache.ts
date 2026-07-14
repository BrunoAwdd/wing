/* global window, crypto, TextEncoder */
import { ChatMessage } from "../hooks/useDocumentChat";

// M4.5: cache local da conversa "Fale com o documento", por documento —
// sem isso, fechar e reabrir o Word sempre perde a conversa (o painel
// recarrega do zero e a sessão de chat no backend é efêmera em memória,
// expira em ~30min). Guardado por `wing_doc_id` (gerado uma vez por
// documento em useAppSetup.ts) + conta autenticada, com TTL — depois de
// expirado, tratado como ausente e removido na próxima leitura.
//
// A conta faz parte da chave: numa máquina compartilhada (ou qualquer troca
// de conta no mesmo dispositivo), sem isso a PRÓXIMA pessoa a abrir o mesmo
// documento restauraria a conversa da conta anterior — grave num app que
// lida com conteúdo potencialmente sensível/jurídico.
const CACHE_KEY_PREFIX = "wing_chat_cache_";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000; // 24h

interface CachedConversation {
  messages: ChatMessage[];
  savedAt: number;
}

// Hash em vez de concatenar o e-mail cru na chave — evita deixar identidade
// legível em texto plano no localStorage (inspecionável via devtools).
const hashHex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => ("0" + b.toString(16)).slice(-2)).join("");
};

const cacheKey = async (accountEmail: string, docId: string): Promise<string> =>
  `${CACHE_KEY_PREFIX}${await hashHex(accountEmail.trim().toLowerCase())}_${docId}`;

export const saveConversation = async (
  accountEmail: string,
  docId: string,
  messages: ChatMessage[]
): Promise<void> => {
  if (!accountEmail || !docId || messages.length === 0) return;
  try {
    const payload: CachedConversation = { messages, savedAt: Date.now() };
    window.localStorage.setItem(await cacheKey(accountEmail, docId), JSON.stringify(payload));
  } catch {
    // localStorage indisponível (modo privado, quota etc.) — degrada pra
    // conversa não persistida, sem quebrar o app.
  }
};

export const loadConversation = async (
  accountEmail: string,
  docId: string,
  ttlMs: number = DEFAULT_TTL_MS
): Promise<ChatMessage[] | null> => {
  if (!accountEmail || !docId) return null;
  try {
    const key = await cacheKey(accountEmail, docId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<CachedConversation>;
    if (!Array.isArray(parsed.messages) || typeof parsed.savedAt !== "number") {
      return null;
    }
    if (Date.now() - parsed.savedAt > ttlMs) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed.messages;
  } catch {
    return null;
  }
};

// Limpeza manual (botão "Limpar conversa") — independente do TTL.
export const clearConversation = async (accountEmail: string, docId: string): Promise<void> => {
  if (!accountEmail || !docId) return;
  try {
    window.localStorage.removeItem(await cacheKey(accountEmail, docId));
  } catch {
    // ignora — nada pra limpar se localStorage já está inacessível.
  }
};
