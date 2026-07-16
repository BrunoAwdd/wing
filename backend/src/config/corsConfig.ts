const DEVELOPMENT_ORIGINS = [
  "https://localhost:5173",
  "https://supercontext-ui.atdigitalbank.com.br",
];

const normalizeOrigin = (value: string): string => {
  const origin = new URL(value).origin;
  if (origin !== value) {
    throw new Error(
      `CORS_ALLOWED_ORIGINS deve conter apenas origens, sem caminho: ${value}`,
    );
  }
  if (origin === "null" || origin === "*") {
    throw new Error(`Origem CORS insegura: ${value}`);
  }
  if (!origin.startsWith("https://")) {
    throw new Error(`Origem CORS deve usar HTTPS: ${value}`);
  }
  return origin;
};

export const resolveCorsOrigins = (
  configuredOrigins: string | undefined,
  isProduction: boolean,
): string[] => {
  const origins = configuredOrigins
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!origins?.length) {
    if (isProduction) {
      throw new Error(
        "CORS_ALLOWED_ORIGINS deve definir o domínio oficial do add-in em produção.",
      );
    }
    return DEVELOPMENT_ORIGINS;
  }

  const resolved = [...new Set(origins.map(normalizeOrigin))];

  // M5: mesmo com allowlist explícita, produção nunca pode acabar
  // autorizando um host de dev/túnel por engano (copy-paste de um .env
  // errado, variável compartilhada entre ambientes etc.) — falha no boot
  // em vez de deixar a origem passar silenciosamente.
  if (isProduction) {
    const leaked = resolved.filter((origin) => DEVELOPMENT_ORIGINS.includes(origin));
    if (leaked.length > 0) {
      throw new Error(
        `CORS_ALLOWED_ORIGINS não pode incluir origens de desenvolvimento em produção: ${leaked.join(", ")}`,
      );
    }
  }

  return resolved;
};
