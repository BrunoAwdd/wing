export const PROMPT_VERSION = "v1";

const hashHex = async (text: string): Promise<string> => {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return Array.from(new Uint8Array(digest)).map((b) =>
    b.toString(16).padStart(2, "0")
  ).join("");
};

export const hashDocumentKey = async (
  accountId: string,
  documentText: string,
  model: string,
  appSessionId: string,
  promptVersion: string = PROMPT_VERSION,
  systemInstruction: string = "",
): Promise<string> =>
  `${accountId}:${await hashHex(documentText)}:${await hashHex(
    systemInstruction,
  )}:${model}:${promptVersion}:${appSessionId}`;
