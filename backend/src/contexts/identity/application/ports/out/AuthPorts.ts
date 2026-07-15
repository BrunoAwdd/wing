export interface MicrosoftIdentity {
  objectId: string;
  tenantId: string;
  email: string;
  displayName?: string;
}

export interface WingSessionClaims {
  accountId: string;
  microsoftObjectId?: string;
  tenantId?: string;
  sessionId: string;
  issuedAt: number;
  expiresAt: number;
}

export interface AccountInfo {
  id: string;
  email: string;
  display_name?: string | null;
}

export interface TokenResponse {
  token: string;
  expiresAt: string;
}

export interface MicrosoftTokenValidator {
  validate(token: string): Promise<MicrosoftIdentity>;
}

export interface MagicLinkProvider {
  requestCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<{ email: string }>;
}

// Portas divididas por operação (em vez de um TokenGenerator/AccountProvider
// únicos e grandes demais): cada caso de uso declara só o que usa, e o
// composition root nunca precisa preencher métodos não utilizados com
// stubs `as any` pra satisfazer uma interface maior.
export interface SessionIssuer {
  issueSession(identity: { accountId: string; microsoftObjectId?: string; tenantId?: string }): Promise<TokenResponse>;
}

export interface RefreshTokenGenerator {
  issueRefreshToken(accountId: string): Promise<TokenResponse>;
  consumeRefreshToken(token: string): Promise<string>;
  revokeRefreshToken(token: string): Promise<void>;
}

export interface MicrosoftAccountProvider {
  getOrCreateFromMicrosoft(identity: MicrosoftIdentity): Promise<AccountInfo>;
  getPlan(accountId: string): Promise<string>;
}

export interface EmailAccountProvider {
  getOrCreateFromEmail(email: string): Promise<AccountInfo>;
  getAccount(accountId: string): Promise<AccountInfo>;
  getPlan(accountId: string): Promise<string>;
}
