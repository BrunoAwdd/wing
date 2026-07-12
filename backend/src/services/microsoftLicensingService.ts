import { billingService } from "./billingService.ts";

/**
 * Service to handle Microsoft Store licensing.
 * Validates the Office.js identity token and checks for active subscriptions.
 */
export const microsoftLicensingService = {
  /**
   * Validates the Microsoft Identity Token (JWT) sent by the add-in.
   * In a real implementation, this would verify the signature against Microsoft's keys.
   * For V1/MVP, we might mock this or implement basic decoding if keys are available.
   */
  validateToken: async (
    token: string
  ): Promise<{ isValid: boolean; email?: string; aud?: string }> => {
    try {
      // TODO: Implement real JWT validation using 'djwt' or similar.
      // We need to fetch Microsoft's public keys from the discovery endpoint.
      // For now, we decode without verification to get the email (unsafe for prod, ok for dev/mvp if we trust the channel).

      // Mock token bypass for dev/fallback
      if (
        token === "wing_test_dummy_token" ||
        token === "wing_personal_dummy_token"
      ) {
        return {
          isValid: true,
          email: "mock_user@example.com",
          aud: "mock_audience",
        };
      }

      // Basic base64 decode of the payload
      const parts = token.split(".");
      if (parts.length !== 3) return { isValid: false };

      const payload = JSON.parse(atob(parts[1]));

      // Check audience (should match our add-in ID)
      // if (payload.aud !== Deno.env.get("MICROSOFT_ADDIN_ID")) return { isValid: false };

      return {
        isValid: true,
        email: payload.preferred_username || payload.email || payload.upn,
        aud: payload.aud,
      };
    } catch (e) {
      console.error("Failed to validate Microsoft token:", e);
      return { isValid: false };
    }
  },

  /**
   * Checks if the user has a valid license in the Microsoft Store.
   * This usually involves calling the Microsoft Graph or a specific Store API.
   *
   * @param token The raw access token from Office.js
   */
  checkEntitlement: async (
    token: string
  ): Promise<{ hasLicense: boolean; plan?: "pro" | "team" | "enterprise" }> => {
    // Mock implementation for MVP
    // In reality, we would call: https://graph.microsoft.com/v1.0/me/monetization/app/products

    // Simulate a check
    // If we want to test "Paid", we can look for a specific flag in the token or just assume true for now.

    // Enterprise Simulation:
    // In a real scenario, we check if the user's tenant ID has a bulk license assigned.
    // For MVP, we simulate this if the email contains "corp" or "enterprise".
    // We can't easily get the email here without decoding the token again or passing it in.
    // Let's assume the token payload has this info or we decode it again.

    // Quick decode to check email for simulation
    try {
      const parts = token.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(atob(parts[1]));
        const email =
          payload.preferred_username || payload.email || payload.upn || "";
        if (email.includes("corp") || email.includes("enterprise")) {
          return { hasLicense: true, plan: "enterprise" };
        }
      }
    } catch (e) {
      // ignore decode error
    }

    return { hasLicense: true, plan: "pro" };
  },

  /**
   * Main entry point to sync a Microsoft user with our billing system.
   */
  syncLicense: async (token: string) => {
    const validation = await microsoftLicensingService.validateToken(token);
    if (!validation.isValid || !validation.email) {
      throw new Error("Invalid Microsoft Token");
    }

    // 1. Ensure Account Exists
    const account = await billingService.getOrCreateAccount(validation.email);

    // 2. Check Store Entitlement
    const entitlement = await microsoftLicensingService.checkEntitlement(token);

    if (entitlement.hasLicense) {
      // 3. Create/Update Subscription
      // We use the user's email or a hash as the external ID if the store doesn't provide a sub ID directly
      // (Store API usually provides a license ID).
      const mockSubId = `ms_sub_${btoa(validation.email).substring(0, 10)}`;

      await billingService.upsertSubscription({
        account_id: account.id,
        external_subscription_id: mockSubId,
        provider: "microsoft",
        plan: entitlement.plan || "pro",
        status: "active",
        current_period_end: new Date(
          Date.now() + 30 * 24 * 60 * 60 * 1000
        ).toISOString(), // +30 days
      });

      return { account, plan: entitlement.plan };
    }

    return { account, plan: "free" };
  },
};
