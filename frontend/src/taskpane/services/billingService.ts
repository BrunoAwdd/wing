/* global process */

const BACKEND_URL = process.env.BACKEND_URL || "";

export interface WingBillingStatus {
  plan: "free" | "pro" | "team" | "enterprise";
  status: string;
  usage: {
    requestsCount: number;
    limit: number;
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
