import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Reusa os certificados locais gerados por `office-addin-dev-certs`, os
// mesmos usados pelo dev server do taskpane (frontend/webpack.config.js),
// para que o backend em desenvolvimento (CORS_ALLOWED_ORIGINS exige HTTPS)
// aceite a origem do site sem configuração extra.
function getHttpsOptions() {
  const certDir = path.join(os.homedir(), ".office-addin-dev-certs");
  try {
    return {
      cert: fs.readFileSync(path.join(certDir, "localhost.crt")),
      key: fs.readFileSync(path.join(certDir, "localhost.key")),
    };
  } catch {
    return undefined;
  }
}

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    https: getHttpsOptions(),
  },
});
