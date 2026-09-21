export type AccountRole = "PROVIDER" | "ADMIN";
export type AuthFailure = "UNAVAILABLE" | "REJECTED";
export type AuthResult = { ok: true; session: boolean } | { ok: false; reason: AuthFailure };

export interface AuthIdentity {
  userId: string;
  email: string;
  role: AccountRole;
}

export interface AuthProvider {
  currentIdentity(): Promise<AuthIdentity | null>;
  signIn(input: { email: string; password: string }): Promise<AuthResult>;
  signUp(input: { email: string; password: string; displayName: string; profession?: string }): Promise<AuthResult>;
  verifyEmail(tokenHash: string): Promise<boolean>;
  signOut(): Promise<void>;
}

export const unconfiguredAuthProvider: AuthProvider = {
  currentIdentity: async () => null,
  signIn: async () => ({ ok: false, reason: "UNAVAILABLE" }),
  signUp: async () => ({ ok: false, reason: "UNAVAILABLE" }),
  verifyEmail: async () => false,
  signOut: async () => undefined,
};
