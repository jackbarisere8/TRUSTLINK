// Payment abstraction — see ARCHITECTURE.md > Payment Abstraction and AGENT.md > Credentials & Secrets.
// V0.1 activates RECORDED only. Do not implement PROTECTED or AUTHORIZED
// until a payment partner is confirmed per PSP-interview-script-v2.

export type PaymentMode = "PROTECTED" | "AUTHORIZED" | "RECORDED";

export interface PaymentCapabilities {
  protectedFunds: boolean;
  authorization: boolean;
  partialRelease: boolean;
  partialRefund: boolean;
}

export interface PaymentProvider {
  getCapabilities(): Promise<PaymentCapabilities>;
  createPayment(input: unknown): Promise<unknown>;
  verifyPayment(reference: string): Promise<unknown>;
}
