import "server-only";
import type { AuthProvider } from "./contracts";
import { identityFromSupabaseUser } from "./identity";
import { authClient } from "./client";

export const supabaseAuthProvider: AuthProvider = {
  async currentIdentity() {
    const { data: { user }, error } = await (await authClient()).auth.getUser();
    return error || !user ? null : identityFromSupabaseUser(user);
  },
  async signIn(input) {
    const { data, error } = await (await authClient()).auth.signInWithPassword(input);
    return error ? { ok: false, reason: "REJECTED" } : { ok: true, session: !!data.session };
  },
  async signUp(input) {
    const { data, error } = await (await authClient()).auth.signUp({
      email: input.email,
      password: input.password,
      options: { data: { display_name: input.displayName, headline: input.profession || "Independent professional" } },
    });
    return error ? { ok: false, reason: "REJECTED" } : { ok: true, session: !!data.session };
  },
  async verifyEmail(tokenHash) {
    const { error } = await (await authClient()).auth.verifyOtp({ token_hash: tokenHash, type: "email" });
    return !error;
  },
  async signOut() {
    await (await authClient()).auth.signOut();
  },
};
