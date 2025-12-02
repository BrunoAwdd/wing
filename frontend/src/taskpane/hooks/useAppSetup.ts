import { useState, useEffect } from "react";
import { getLicenseToken } from "../services/licensingService";
import { initEngine } from "../../services/wingMemoryEngine";
import { track } from "../services/telemetry";
import { LogEntry } from "../components/StatusBar";

interface AppSetupProps {
  addLog: (message: string, type: LogEntry["type"]) => void;
  showFluentToast: (message: string, type: "info" | "success" | "error") => void;
}

export const useAppSetup = ({ addLog, showFluentToast }: AppSetupProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [licenseToken, setLicenseToken] = useState<string | null>(null);

  useEffect(() => {
    const setupApp = async () => {
      // 1. License
      addLog("Obtendo token de licença...", "info");
      const token = await getLicenseToken();
      console.log("Token de Licença Obtido:", token);
      setLicenseToken(token);

      if (token === "ERROR_FETCHING_TOKEN") {
        addLog("Não foi possível obter o token de licença.", "error");
        showFluentToast("Atenção: Não foi possível verificar sua licença.", "error");
      } else {
        addLog("Token de licença obtido com sucesso.", "success");
        showFluentToast("Pronto para uso.", "success");
      }

      // 2. Persistence (RFC 005)
      try {
        const settings = Office.context.document.settings;
        let docId = settings.get("wing_doc_id") as string;

        if (!docId) {
          docId = crypto.randomUUID();
          settings.set("wing_doc_id", docId);
          await new Promise<void>((resolve, reject) => {
            settings.saveAsync((result) => {
              if (result.status === Office.AsyncResultStatus.Failed) {
                console.error("[Persistence] Failed to save docId:", result.error);
                reject(result.error);
              } else {
                console.log(`[Persistence] Generated new docId: ${docId}`);
                resolve();
              }
            });
          });
        } else {
          console.log(`[Persistence] Loaded existing docId: ${docId}`);
        }

        await initEngine(docId);
        track("panel_opened");
        addLog("Bem-vindo ao Wing!", "info");
      } catch (e) {
        console.error("Failed to setup persistence:", e);
      }
    };

    setupApp();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { licenseToken, isOnline };
};
