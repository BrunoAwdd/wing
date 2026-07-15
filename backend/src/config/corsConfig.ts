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

  return [...new Set(origins.map(normalizeOrigin))];
};
