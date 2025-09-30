import { track } from "./telemetry";
/* global OfficeRuntime */

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:3001";

let appJwt: string | null = null;

export const loginWithOffice = async () => {
  try {
    console.log("Iniciando login com Office...");
    const msToken = await OfficeRuntime.auth.getAccessToken({ allowSignInPrompt: true });
    console.log("Token do MS obtido, enviando para o backend...");

    const response = await fetch(`${BACKEND_URL}/auth/office`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msToken }),
    });

    console.log("Resposta do backend recebida:", response);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("A resposta do backend não foi OK:", response.status, errorText);
      throw new Error(`Falha na autenticação com o backend: ${response.status} ${errorText}`);
    }

    const { appJwt: newAppJwt } = await response.json();
    if (!newAppJwt) {
        console.error("O appJwt não foi encontrado na resposta do backend.");
        throw new Error("O appJwt não foi encontrado na resposta do backend.");
    }

    appJwt = newAppJwt;
    console.log("Login com Office bem-sucedido!");
    track("login_success", { method: "office_sso" });
    return true;
  } catch (error) {
    console.error("Erro detalhado ao fazer login com o Office:", error);
    let errorMessage = error.message;
    switch (error.code) {
      case 13001:
        errorMessage = "O usuário cancelou o login.";
        break;
      case 13002:
        errorMessage = "Não foi possível obter o token de acesso. Verifique se o usuário está logado no Office e tem as permissões necessárias.";
        break;
      case 13003:
        errorMessage = "Ocorreu um erro de configuração. Verifique se o manifesto do suplemento está configurado corretamente.";
        break;
      case 13007:
        errorMessage = "Ocorreu um erro inesperado no servidor de autenticação. Verifique a configuração do aplicativo no Azure AD.";
        break;
    }
    track("login_failed", { method: "office_sso", message: errorMessage, code: error.code });
    return false;
  }
};

export const logout = () => {
  appJwt = null;
  track("logout");
};

export const getToken = () => {
  return appJwt;
};

export const isLoggedIn = () => {
  return !!appJwt;
};