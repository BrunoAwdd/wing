/* global process */

const BACKEND_URL = process.env.BACKEND_URL || "";

export interface WingBillingStatus {
  plan: "free" | "pro" | "team" | "enterprise";
  status: string;
  usage: {
    requestsCount: number;
    tokensUsed: number;
    creditsUsed: number;
    creditLimit: number | null;
  };
}

export class WingBillingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WingBillingError";
  }
}

const readError = async (response: Response): Promise<string> => {
  try {
    const body = await response.json();
    return body.error || "Não foi possível completar a operação de assinatura.";
  } catch {
    return "Não foi possível completar a operação de assinatura.";
  }
};

const fetchBackend = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch {
    throw new WingBillingError("O servidor do Wing está indisponível. Tente novamente em instantes.");
  }
};

export const getBillingStatus = async (sessionToken: string): Promise<WingBillingStatus> => {
  const response = await fetchBackend(`${BACKEND_URL}/api/v1/billing/status`, {
    method: "GET",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!response.ok) {
    throw new WingBillingError(await readError(response));
  }

  return (await response.json()) as WingBillingStatus;
};

export const startCheckout = async (sessionToken: string): Promise<string> => {
  const response = await fetchBackend(`${BACKEND_URL}/api/v1/billing/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!response.ok) {
    throw new WingBillingError(await readError(response));
  }

  const { url } = (await response.json()) as { url: string };
  return url;
};

export const openBillingPortal = async (sessionToken: string): Promise<string> => {
  const response = await fetchBackend(`${BACKEND_URL}/api/v1/billing/portal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });

  if (!response.ok) {
    throw new WingBillingError(await readError(response));
  }

  const { url } = (await response.json()) as { url: string };
  return url;
};

// O backend calcula o custo em créditos — o painel nunca sabe qual modelo
// real está por trás do nível de qualidade escolhido.
export interface EstimateParagraph {
  id: string;
  text: string;
}

// Manda os mesmos parágrafos (e o mesmo tom) que a execução real do rewrite
// vai usar — o backend monta o prompt estruturado idêntico ao da cobrança
// de verdade, senão a estimativa fica sistematicamente menor que a reserva
// real (o wrapper de instruções não entrava na conta).
export const estimateCredits = async (
  sessionToken: string,
  paragraphs: EstimateParagraph[],
  qualityLevel: string,
  tone?: string
): Promise<number> => {
  const response = await fetchBackend(`${BACKEND_URL}/api/v1/billing/estimate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({ paragraphs, qualityLevel, tone }),
  });

  if (!response.ok) {
    throw new WingBillingError(await readError(response));
  }

  const { credits } = (await response.json()) as { credits: number };
  return credits;
};
