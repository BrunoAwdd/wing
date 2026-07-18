export interface PaymentProvider {
  createCustomer(email: string): Promise<string>;
}
