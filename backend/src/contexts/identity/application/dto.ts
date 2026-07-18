import { TokenResponse } from "./ports/out/AuthPorts.ts";

export interface TelemetryTracker {
  trackEvent(
    eventName: string,
    properties?: Record<string, unknown>,
    accountId?: string,
  ): void;
}

export interface AuthSessionResponse extends TokenResponse {
  refreshToken?: string;
  refreshTokenExpiresAt?: string;
  user: {
    email: string;
    displayName: string | null;
    plan: string;
    accessStatus: "free" | "waitlisted" | "paid";
    waitlistPosition?: number;
  };
}
