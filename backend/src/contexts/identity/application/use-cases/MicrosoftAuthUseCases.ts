import { MicrosoftAccountProvider, MicrosoftTokenValidator, SessionIssuer } from "../ports/out/AuthPorts.ts";
import { AuthSessionResponse, TelemetryTracker } from "../dto.ts";

export class MicrosoftAuthUseCases {
  constructor(
    private readonly microsoftValidator: MicrosoftTokenValidator,
    private readonly sessionIssuer: SessionIssuer,
    private readonly accountProvider: MicrosoftAccountProvider,
    private readonly telemetry: TelemetryTracker,
  ) {}

  async authenticateWithMicrosoft(accessToken: string): Promise<AuthSessionResponse> {
    const identity = await this.microsoftValidator.validate(accessToken);
    const account = await this.accountProvider.getOrCreateFromMicrosoft(identity);
    const plan = await this.accountProvider.getPlan(account.id);
    const session = await this.sessionIssuer.issueSession({
      accountId: account.id,
      microsoftObjectId: identity.objectId,
      tenantId: identity.tenantId,
    });

    this.telemetry.trackEvent("office_sso_success", undefined, account.id);

    return {
      ...session,
      user: {
        email: account.email,
        displayName: account.display_name || identity.displayName || null,
        plan,
      },
    };
  }
}
