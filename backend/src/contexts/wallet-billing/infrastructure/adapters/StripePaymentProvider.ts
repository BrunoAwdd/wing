import { stripeService } from "../../../../services/stripeService.ts";
import { PaymentProvider } from "../../application/ports/out/PaymentProvider.ts";

export class StripePaymentProvider implements PaymentProvider {
  async createCustomer(email: string): Promise<string> {
    return stripeService.createCustomer(email);
  }
}
