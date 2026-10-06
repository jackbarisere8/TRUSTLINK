"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthProvider } from "@/lib/auth/provider";
import { credentialsSchema, passwordRecoveryRequestSchema, passwordUpdateSchema, signupSchema } from "@/lib/auth/schemas";
import { resolveApplicationOrigin, safeReturnPath } from "@/lib/auth/redirects";
import { consumeRateLimits, rateLimitPolicies } from "@/lib/security/rate-limit";
import { currentClientAddress } from "@/lib/security/request";
import { recordOperationalEvent } from "@/lib/observability";
import { db } from "@/lib/db";
import { resolveUserSession } from "@/lib/auth/session";

const unavailable = "Account access is not configured on this installation. You can still explore the example agreement preview.";
const limited = (seconds: number) => `Too many attempts. Wait about ${Math.max(1, Math.ceil(seconds / 60))} minute(s) and try again.`;

function destination(role: "CUSTOMER" | "PROVIDER" | "ADMIN") {
  return role === "ADMIN" ? "/admin" : role === "PROVIDER" ? "/dashboard" : "/account";
}

async function authLimit(
  operation: "login" | "signup" | "recovery" | "password-update",
  account: string,
) {
  const address = await currentClientAddress();
  if (operation === "login") return consumeRateLimits([
    { scope: "auth.login.address", identifier: address, policy: rateLimitPolicies.authLoginAddress },
    { scope: "auth.login.account", identifier: account, policy: rateLimitPolicies.authLoginAccount },
  ]);
  if (operation === "signup") return consumeRateLimits([
    { scope: "auth.signup.address", identifier: address, policy: rateLimitPolicies.authSignupAddress },
    { scope: "auth.signup.account", identifier: account, policy: rateLimitPolicies.authSignupAccount },
  ]);
  if (operation === "recovery") return consumeRateLimits([
    { scope: "auth.recovery.address", identifier: address, policy: rateLimitPolicies.authRecoveryAddress },
    { scope: "auth.recovery.account", identifier: account, policy: rateLimitPolicies.authRecoveryAccount },
  ]);
  return consumeRateLimits([
    { scope: "auth.password-update.address", identifier: address, policy: rateLimitPolicies.authPasswordUpdate },
  ]);
}

export async function loginAction(form: FormData) {
  const returnTo = safeReturnPath(form.get("returnTo"), "");
  const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };
  const limit = await authLimit("login", parsed.data.email);
  if (!limit.allowed) {
    recordOperationalEvent({ event: "auth.login", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
    return { error: limited(limit.retryAfterSeconds) };
  }
  const provider = getAuthProvider();
  const result = await provider.signIn(parsed.data);
  if (!result.ok) {
    recordOperationalEvent({ event: "auth.login", outcome: "rejected" });
    return { error: result.reason === "UNAVAILABLE" ? unavailable : "We couldn't sign you in. Check your credentials and email confirmation." };
  }
  const user = await resolveUserSession(provider, db);
  if (!user) {
    recordOperationalEvent({ event: "auth.login", outcome: "rejected" });
    return { error: "Your account profile could not be loaded. Try again." };
  }
  recordOperationalEvent({ event: "auth.login", outcome: "success" });
  redirect(returnTo || destination(user.role));
}
export async function signupAction(form: FormData) {
  const returnTo = safeReturnPath(form.get("returnTo"), "");
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your name, a valid email, and a password of at least 8 characters." };
  const limit = await authLimit("signup", parsed.data.email);
  if (!limit.allowed) {
    recordOperationalEvent({ event: "auth.signup", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
    return { error: limited(limit.retryAfterSeconds) };
  }
  const provider = getAuthProvider();
  const result = await provider.signUp(parsed.data);
  if (!result.ok) {
    recordOperationalEvent({ event: "auth.signup", outcome: "rejected" });
    return { error: result.reason === "UNAVAILABLE" ? unavailable : "We couldn't create the account. Try again or sign in if you already have one." };
  }
  recordOperationalEvent({ event: "auth.signup", outcome: "success" });
  if (!result.session) return { message: "Check your email to confirm your account, then log in." };
  const user = await resolveUserSession(provider, db);
  if (!user) return { error: "Your account was created, but its profile could not be loaded. Sign in again shortly." };
  redirect(returnTo || destination(user.role));
}
export async function requestPasswordResetAction(form: FormData) {
  const parsed = passwordRecoveryRequestSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email address." };
  const limit = await authLimit("recovery", parsed.data.email);
  if (!limit.allowed) {
    recordOperationalEvent({ event: "auth.recovery.request", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
    return { error: limited(limit.retryAfterSeconds) };
  }

  let redirectTo: string;
  try {
    redirectTo = new URL("/auth/recovery", resolveApplicationOrigin()).toString();
  } catch {
    recordOperationalEvent({ event: "auth.recovery.request", outcome: "failure" });
    return { error: unavailable };
  }

  const result = await getAuthProvider().requestPasswordReset({ email: parsed.data.email, redirectTo });
  if (!result.ok && result.reason === "UNAVAILABLE") {
    recordOperationalEvent({ event: "auth.recovery.request", outcome: "failure" });
    return { error: unavailable };
  }
  // Provider rejection stays indistinguishable from success to avoid account enumeration.
  recordOperationalEvent({ event: "auth.recovery.request", outcome: result.ok ? "success" : "rejected" });
  return { message: "If an account exists for that email, a password reset link will arrive shortly." };
}
export async function resetPasswordAction(form: FormData) {
  const parsed = passwordUpdateSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Use 8 to 128 characters and enter the same password twice." };
  const limit = await authLimit("password-update", "recovery-session");
  if (!limit.allowed) {
    recordOperationalEvent({ event: "auth.recovery.complete", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
    return { error: limited(limit.retryAfterSeconds) };
  }
  const provider = getAuthProvider();
  const result = await provider.updatePassword(parsed.data.password);
  if (!result.ok) {
    recordOperationalEvent({ event: "auth.recovery.complete", outcome: "rejected" });
    return { error: result.reason === "UNAVAILABLE" ? unavailable : "This password reset session is invalid or expired. Request a new link." };
  }
  await provider.signOut();
  recordOperationalEvent({ event: "auth.recovery.complete", outcome: "success" });
  redirect("/login?recovery=updated");
}
export async function logoutAction() {
  await getAuthProvider().signOut();
  // Removed from authentication long ago; clear it so legacy data cannot look like a live session.
  (await cookies()).delete("tl_session_token");
  redirect("/login");
}
