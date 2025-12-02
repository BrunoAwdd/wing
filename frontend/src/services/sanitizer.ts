/**
 * Wing Input Sanitizer (RFC 006)
 * Removes potentially malicious content from user input and document text.
 */
export const sanitizer = {
  sanitizeInput: (text: string): string => {
    if (!text) return "";

    let clean = text;

    // 1. Remove <script> tags
    clean = clean.replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "");

    // 2. Remove potential macros (basic heuristic)
    clean = clean.replace(/Sub\s+\w+\s*\(/gim, "BlockedMacro(");

    // 3. Remove hidden metadata markers (example)
    clean = clean.replace(/<!--\s*METADATA_START[\s\S]*?METADATA_END\s*-->/gim, "");

    return clean;
  },
};
