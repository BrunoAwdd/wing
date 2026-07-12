import { useState, useEffect, useCallback } from "react";

const API_BASE_URL = "/api";

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  user: {
    email?: string;
    plan?: "free" | "pro" | "team";
  } | null;
}

export const useMicrosoftAuth = () => {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
    user: null,
  });

  const [isSSOFailed, setIsSSOFailed] = useState(false);

  const loginWithDialog = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
    try {
      const fallbackToken = await new Promise((resolve, reject) => {
        Office.context.ui.displayDialogAsync(
          window.location.origin + "/auth-fallback.html",
          { height: 50, width: 50, displayInIframe: true },
          (asyncResult) => {
            if (asyncResult.status === Office.AsyncResultStatus.Failed) {
              reject(new Error(asyncResult.error.message));
            } else {
              const dialog = asyncResult.value;
              dialog.addEventHandler(Office.EventType.DialogMessageReceived, (arg: any) => {
                const message = JSON.parse(arg.message);
                if (message.status === "success") {
                  dialog.close();
                  resolve(message.token);
                } else {
                  dialog.close();
                  reject(new Error("Auth failed in dialog"));
                }
              });
            }
          }
        );
      });

      // Send to Backend
      const response = await fetch(`${API_BASE_URL}/auth/microsoft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: fallbackToken }),
      });

      if (!response.ok) throw new Error("Backend authentication failed");
      const data = await response.json();

      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        user: { email: data.account.email, plan: data.plan },
      });
      setIsSSOFailed(false); // Reset failure state on success
    } catch (error: any) {
      console.error("Dialog Login Failed:", error);
      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || "Dialog login failed",
        isAuthenticated: false,
      }));
    }
  }, []);

  const login = useCallback(async () => {
    setAuthState((prev) => ({ ...prev, isLoading: true, error: null }));
    setIsSSOFailed(false);
    try {
      // 1. Get Token from Office.js
      // Note: This requires the add-in manifest to be configured for SSO.
      // If running outside Office (e.g. browser dev), this will fail or need a mock.
      let token: string;

      try {
        if (typeof Office !== "undefined" && Office.auth) {
          token = await Office.auth.getAccessToken({
            allowSignInPrompt: true,
            allowConsentPrompt: true,
            forMSGraphAccess: false, // We only need identity for now
          });
        } else {
          // Dev/Mock mode
          console.warn("Office.auth not available. Using mock token.");
          token = "wing_test_dummy_token"; // Matches our backend bypass if set, or fails.
        }
      } catch (officeError: any) {
        console.error("Office Auth Failed:", officeError);
        // Fallback or error handling
        // If code 13003, user cancelled.
        throw new Error(`Office Auth Failed: ${officeError.message} (Code: ${officeError.code})`);
      }

      // 2. Send to Backend
      const response = await fetch(`${API_BASE_URL}/auth/microsoft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      if (!response.ok) {
        throw new Error("Backend authentication failed");
      }

      const data = await response.json();

      // 3. Update State
      setAuthState({
        isAuthenticated: true,
        isLoading: false,
        error: null,
        user: {
          email: data.account.email,
          plan: data.plan,
        },
      });
    } catch (error: any) {
      console.error("Login Failed:", error);

      let errorMessage = error.message || "Login failed";

      // Handle specific Office Auth errors
      if (errorMessage.includes("13007") || errorMessage.includes("unexpected error")) {
        // Mark SSO as failed so UI can show the fallback button
        setIsSSOFailed(true);
        errorMessage =
          "Conta pessoal detectada ou erro de configuração. Por favor, use o botão 'Entrar com Conta Pessoal' abaixo.";
      } else if (errorMessage.includes("13003")) {
        errorMessage = "Login cancelado pelo usuário.";
      }

      setAuthState((prev) => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
        isAuthenticated: false,
      }));
    }
  }, []);

  // Auto-login on mount (optional, or trigger via button)
  useEffect(() => {
    // For better UX, we might want to wait for user action,
    // but for "seamless" experience, we can try silent login.
    // login();
    // Let's leave it manual or controlled by the parent for now to avoid loops.
    setAuthState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  return {
    ...authState,
    isSSOFailed,
    login,
    loginWithDialog,
  };
};
