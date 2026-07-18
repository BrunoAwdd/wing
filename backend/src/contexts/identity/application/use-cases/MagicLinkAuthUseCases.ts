import {
  EmailAccountProvider,
  MagicLinkProvider,
  RefreshTokenGenerator,
  SessionIssuer,
} from "../ports/out/AuthPorts.ts";
import { AuthSessionResponse, TelemetryTracker } from "../dto.ts";

export class MagicLinkAuthUseCases {
  constructor(
    private readonly magicLinkProvider: MagicLinkProvider,
    private readonly sessionIssuer: SessionIssuer,
    private readonly refreshTokenGenerator: RefreshTokenGenerator,
    private readonly accountProvider: EmailAccountProvider,
    private readonly telemetry: TelemetryTracker,
  ) {}

  async requestMagicLink(email: string): Promise<void> {
    await this.magicLinkProvider.requestCode(email);
    this.telemetry.trackEvent("magic_link_requested");
  }

  async verifyMagicLink(
    email: string,
    code: string,
  ): Promise<AuthSessionResponse> {
    const verified = await this.magicLinkProvider.verifyCode(email, code);
    const account = await this.accountProvider.getOrCreateFromEmail(
      verified.email,
    );
    const plan = await this.accountProvider.getPlan(account.id);
    const session = await this.sessionIssuer.issueSession({
      accountId: account.id,
    });
    const refreshToken = await this.refreshTokenGenerator.issueRefreshToken(
      account.id,
    );

    this.telemetry.trackEvent("magic_link_verified", undefined, account.id);

    return {
      ...session,
      refreshToken: refreshToken.token,
      refreshTokenExpiresAt: refreshToken.expiresAt,
      user: {
        email: account.email,
        displayName: account.display_name || null,
        plan,
        ...this.accessState(account, plan),
      },
    };
  }

  async refreshSession(refreshToken: string): Promise<AuthSessionResponse> {
    const accountId = await this.refreshTokenGenerator.consumeRefreshToken(
      refreshToken,
    );
    const account = await this.accountProvider.getAccount(accountId);
    const plan = await this.accountProvider.getPlan(accountId);
    const session = await this.sessionIssuer.issueSession({ accountId });
    const nextRefreshToken = await this.refreshTokenGenerator.issueRefreshToken(
      accountId,
    );

    this.telemetry.trackEvent("session_refreshed", undefined, accountId);

    return {
      ...session,
      refreshToken: nextRefreshToken.token,
      refreshTokenExpiresAt: nextRefreshToken.expiresAt,
      user: {
        email: account.email,
        displayName: account.display_name || null,
        plan,
        ...this.accessState(account, plan),
      },
    };
  }

  async logout(refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await this.refreshTokenGenerator.revokeRefreshToken(refreshToken).catch(
        (err) => {
          console.error(
            "[MagicLinkAuthUseCases] Falha ao revogar refresh token no logout:",
            err,
          );
        },
      );
    }
  }

  private accessState(
    account: Awaited<ReturnType<EmailAccountProvider["getAccount"]>>,
    plan: string,
  ) {
    if (plan !== "free") return { accessStatus: "paid" as const };
    if (account.waitlisted_at) {
      return {
        accessStatus: "waitlisted" as const,
        ...(account.waitlist_position
          ? { waitlistPosition: account.waitlist_position }
          : {}),
      };
    }
    return { accessStatus: "free" as const };
  }
}
