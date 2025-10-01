import { useState, useEffect } from "react";
import { getLicenseToken } from "../services/licensingService";
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
    const fetchLicenseToken = async () => {
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
    };

    fetchLicenseToken();
    track("panel_opened");
    addLog("Bem-vindo ao Wing!", "info");

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
