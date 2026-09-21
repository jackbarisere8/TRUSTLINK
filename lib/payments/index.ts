import type { PaymentProvider, PaymentCapabilities, PaymentMode } from "./types";

/**
 * V0.1 RecordedPaymentProvider
 * Strictly enforces that TrustLink only records payments between parties.
 * Never activates FUNDS_PROTECTED or PAYMENT_AUTHORIZED until a verified partner
 * is confirmed per AGENT.md §3 and PSP-interview-script-v2.
 */
export class RecordedPaymentAdapter implements PaymentProvider {
  async getCapabilities(): Promise<PaymentCapabilities> {
    return {
      protectedFunds: false,
      authorization: false,
      partialRelease: false,
      partialRefund: false,
    };
  }

  async createPayment(): Promise<never> {
    throw new Error("Payment processing is unavailable. Record a direct receipt through the authorized transaction action.");
  }

  async verifyPayment(reference: string): Promise<{
    reference: string;
    mode: PaymentMode;
    verified: boolean;
    verificationStatus: "NOT_VERIFIED";
    timestamp: string;
  }> {
    return {
      reference,
      mode: "RECORDED",
      verified: false,
      verificationStatus: "NOT_VERIFIED",
      timestamp: new Date().toISOString(),
    };
  }
}

export const defaultPaymentProvider = new RecordedPaymentAdapter();
export * from "./types";
