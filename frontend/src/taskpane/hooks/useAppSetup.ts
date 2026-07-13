import { useCallback, useEffect, useRef, useState } from "react";
import { initEngine } from "../../services/wingMemoryEngine";
import { track } from "../services/telemetry";
import {
  clearPersistedRefreshToken,
  closeWingSession,
  createWingSession,
  loadPersistedRefreshToken,
  persistRefreshToken,
  refreshSession,
  requestMagicLinkCode,
  verifyMagicLinkCode,
  type WingSession,
} from "../services/sessionService";
import { LogEntry } from "../components/StatusBar";

/* global Office, crypto, navigator, window, process */

// A Wing vende direto via Stripe (não pelo comércio da Microsoft Store), então
// login por e-mail é o padrão. O SSO Microsoft continua no código (RFC 013),
// só desligado por padrão — reativável via WING_FEATURE_MICROSOFT_SSO=true.
const MICROSOFT_SSO_ENABLED = process.env.WING_FEATURE_MICROSOFT_SSO === "true";

interface AppSetupProps {
  addLog: (message: string, type: LogEntry["type"]) => void;
  showFluentToast: (message: string, type: "info" | "success" | "error") => void;
}

export type AuthStatus = "loading" | "needs_login" | "authenticated" | "error" | "signed_out";

export const useAppSetup = ({ addLog, showFluentToast }: AppSetupProps) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [session, setSession] = useState<WingSession | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [authError, setAuthError] = useState<string | null>(null);
  const authRequestId = useRef(0);
  const panelTracked = useRef(false);

  const authenticate = useCallback(
    async (silent = false) => {
      const requestId = ++authRequestId.current;
      if (!silent) setAuthStatus("loading");
      setAuthError(null);

      try {
        const nextSession = await createWingSession();
        if (requestId !== authRequestId.current) return;

        setSession(nextSession);
        setAuthStatus("authenticated");
        if (!silent) {
          addLog("Sessão Wing iniciada com sua conta Microsoft.", "success");
          showFluentToast("Sessão iniciada com segurança.", "success");
        }
      } catch (error) {
        if (requestId !== authRequestId.current) return;

        const message =
          error instanceof Error ? error.message : "Não foi possível iniciar a sessão Wing.";
        setSession(null);
        setAuthStatus("error");
        setAuthError(message);
        addLog(message, "error");
        if (!silent) showFluentToast(message, "error");
      }
    },
    [addLog, showFluentToast]
  );

  // Troca o refresh token persistido por uma sessão Wing nova, sem pedir
  // e-mail/código de novo — usado tanto ao abrir o painel (restaurar a
  // sessão de uma vez anterior) quanto pouco antes da sessão curta expirar
  // durante o uso (renovação silenciosa em segundo plano).
  const refreshWithToken = useCallback(async (refreshToken: string): Promise<boolean> => {
    const requestId = ++authRequestId.current;
    try {
      const nextSession = await refreshSession(refreshToken);
      if (requestId !== authRequestId.current) return true;

      setSession(nextSession);
      persistRefreshToken(nextSession);
      setAuthStatus("authenticated");
      return true;
    } catch {
      if (requestId !== authRequestId.current) return true;

      clearPersistedRefreshToken();
      setSession(null);
      return false;
    }
  }, []);

  const requestCode = useCallback(
    async (email: string) => {
      setAuthError(null);
      try {
        await requestMagicLinkCode(email);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Não foi possível enviar o código.";
        setAuthError(message);
        addLog(message, "error");
        showFluentToast(message, "error");
        throw error;
      }
    },
    [addLog, showFluentToast]
  );

  const verifyCode = useCallback(
    async (email: string, code: string) => {
      const requestId = ++authRequestId.current;
      setAuthStatus("loading");
      setAuthError(null);

      try {
        const nextSession = await verifyMagicLinkCode(email, code);
        if (requestId !== authRequestId.current) return;

        setSession(nextSession);
        persistRefreshToken(nextSession);
        setAuthStatus("authenticated");
        addLog("Sessão Wing iniciada.", "success");
        showFluentToast("Sessão iniciada com segurança.", "success");
      } catch (error) {
        if (requestId !== authRequestId.current) return;

        const message =
          error instanceof Error ? error.message : "Não foi possível iniciar a sessão Wing.";
        setSession(null);
        setAuthStatus("needs_login");
        setAuthError(message);
        addLog(message, "error");
        showFluentToast(message, "error");
      }
    },
    [addLog, showFluentToast]
  );

  const signOut = useCallback(async () => {
    authRequestId.current += 1;
    const token = session?.token;
    const refreshToken = session?.refreshToken;
    setSession(null);
    setAuthError(null);
    setAuthStatus("signed_out");
    panelTracked.current = false;
    clearPersistedRefreshToken();
    if (token) await closeWingSession(token, refreshToken);
    addLog("Sessão Wing encerrada.", "info");
  }, [addLog, session?.token, session?.refreshToken]);

  useEffect(() => {
    if (MICROSOFT_SSO_ENABLED) {
      void authenticate();
    } else {
      // Persistência de login: se há um refresh token salvo de uma sessão
      // anterior, tenta renovar silenciosamente antes de pedir e-mail/código
      // — sem isso, todo fechar/reabrir do Word força login de novo.
      const persistedRefreshToken = loadPersistedRefreshToken();
      if (persistedRefreshToken) {
        void refreshWithToken(persistedRefreshToken).then((restored) => {
          if (!restored) setAuthStatus("needs_login");
        });
      } else {
        setAuthStatus("needs_login");
      }
    }
    return () => {
      authRequestId.current += 1;
    };
  }, [authenticate, refreshWithToken]);

  useEffect(() => {
    if (!session) return undefined;

    const refreshAt = new Date(session.expiresAt).getTime() - 2 * 60 * 1000;
    if (!Number.isFinite(refreshAt)) return undefined;
    const delay = Math.max(30_000, refreshAt - Date.now());
    const timer = window.setTimeout(() => {
      if (session.refreshToken) {
        // Fluxo magic link: renova via refresh token, não via Office.auth
        // (que só existe pro SSO Microsoft e falharia aqui).
        void refreshWithToken(session.refreshToken).then((restored) => {
          if (!restored) {
            setAuthStatus("needs_login");
            addLog("Sessão expirada. Faça login novamente.", "info");
          }
        });
      } else {
        void authenticate(true);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [authenticate, refreshWithToken, session, addLog]);

  useEffect(() => {
    if (!session || panelTracked.current) return;
    panelTracked.current = true;
    track("panel_opened", undefined, session.token);
  }, [session]);

  useEffect(() => {
    const setupMemory = async () => {
      try {
        const settings = Office.context.document.settings;
        let docId = settings.get("wing_doc_id") as string;

        if (!docId) {
          docId = crypto.randomUUID();
          settings.set("wing_doc_id", docId);
          await new Promise<void>((resolve, reject) => {
            settings.saveAsync((result) => {
              if (result.status === Office.AsyncResultStatus.Failed) {
                reject(result.error);
              } else {
                resolve();
              }
            });
          });
        }

        try {
          await initEngine(docId);
        } catch (error) {
          console.error("[WingMemoryEngine] Failed to initialize:", error);
          addLog("Busca semântica no documento indisponível nesta sessão.", "info");
          showFluentToast(
            "Contexto semântico indisponível. O restante do Wing funciona normalmente.",
            "info"
          );
        }
      } catch (error) {
        console.error("Failed to setup persistence:", error);
      }
    };

    void setupMemory();
  }, [addLog, showFluentToast]);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return {
    sessionToken: session?.token || null,
    sessionUser: session?.user || null,
    authStatus,
    authError,
    retryAuth: authenticate,
    requestCode,
    verifyCode,
    signOut,
    isOnline,
  };
};
