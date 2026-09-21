import type { AuthIdentity } from "./contracts";

type SupabaseUserShape = {
  id: string;
  email?: string | null;
  app_metadata?: Record<string, unknown> | null;
  user_metadata?: Record<string, unknown> | null; // Accepted only to make its deliberate exclusion explicit.
};

/** Only server-controlled app_metadata may grant administrator access. */
export function identityFromSupabaseUser(user: SupabaseUserShape): AuthIdentity {
  return {
    userId: user.id,
    email: user.email || "",
    role: user.app_metadata?.role === "ADMIN" ? "ADMIN" : "PROVIDER",
  };
}
