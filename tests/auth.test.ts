import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAuthConfiguration } from "../lib/auth/config";
import { identityFromSupabaseUser } from "../lib/auth/identity";
import {
  confirmationSchema,
  credentialsSchema,
  passwordRecoveryRequestSchema,
  passwordUpdateSchema,
  recoveryCallbackSchema,
  signupSchema,
} from "../lib/auth/schemas";
import { resolveApplicationOrigin } from "../lib/auth/redirects";
import { resolveUserSession } from "../lib/auth/session";
import { unconfiguredAuthProvider, type AuthProvider } from "../lib/auth/contracts";
import type { Repository } from "../lib/db/repository";

test("authentication is explicitly unconfigured locally and validates Supabase endpoints", () => {
  assert.deepEqual(resolveAuthConfiguration({ TRUSTLINK_STORAGE: "local", NEXT_PUBLIC_SUPABASE_URL: "https://ignored.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "ignored" }), { mode: "unconfigured" });
  assert.deepEqual(resolveAuthConfiguration({}), { mode: "unconfigured" });
  assert.deepEqual(resolveAuthConfiguration({ TRUSTLINK_STORAGE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "https://project.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key" }), { mode: "supabase", url: "https://project.supabase.co", anonKey: "public-key" });
  assert.equal(resolveAuthConfiguration({ TRUSTLINK_STORAGE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54329", NEXT_PUBLIC_SUPABASE_ANON_KEY: "test-only" }).mode, "supabase");
  assert.throws(() => resolveAuthConfiguration({ TRUSTLINK_STORAGE: "supabase" }), /incomplete/);
  assert.throws(() => resolveAuthConfiguration({ TRUSTLINK_STORAGE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "not a url", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key" }), /invalid/);
  assert.throws(() => resolveAuthConfiguration({ TRUSTLINK_STORAGE: "supabase", NEXT_PUBLIC_SUPABASE_URL: "http://public.example", NEXT_PUBLIC_SUPABASE_ANON_KEY: "public-key" }), /HTTPS/);
});

test("administrator authority comes only from app_metadata", () => {
  assert.equal(identityFromSupabaseUser({ id: "one", app_metadata: { role: "ADMIN" }, user_metadata: { role: "PROVIDER" } }).role, "ADMIN");
  assert.equal(identityFromSupabaseUser({ id: "two", app_metadata: { role: "PROVIDER" }, user_metadata: { role: "ADMIN" } }).role, "CUSTOMER");
  assert.equal(identityFromSupabaseUser({ id: "three", user_metadata: { role: "ADMIN" } }).role, "CUSTOMER");
});

test("session resolution derives provider access from the application profile", async () => {
  const identity = { userId: "11111111-1111-4111-8111-111111111111", email: "provider@example.test", role: "CUSTOMER" as const };
  const profile = { id: "profile", userId: identity.userId, username: "provider", displayName: "Provider", country: "Nigeria", createdAt: new Date().toISOString() };
  const providerProfile = { id: "provider-profile", userId: identity.userId };
  let profileReads = 0;
  const repository = { getProfileBundleByUserId: async () => { profileReads++; return { profile, providerProfile }; } } as unknown as Repository;
  const provider = { currentIdentity: async () => identity } as unknown as AuthProvider;
  assert.deepEqual(await resolveUserSession(provider, repository), { ...identity, role: "PROVIDER", providerEnabled: true, username: "provider", displayName: "Provider" });
  assert.equal(profileReads, 1);
  assert.equal(await resolveUserSession({ currentIdentity: async () => null } as unknown as AuthProvider, repository), null);
  assert.equal(profileReads, 1);
  const customerRepository = { getProfileBundleByUserId: async () => ({ profile, providerProfile: null }) } as unknown as Repository;
  assert.deepEqual(await resolveUserSession(provider, customerRepository), { ...identity, role: "CUSTOMER", providerEnabled: false, username: "provider", displayName: "Provider" });
  const mismatch = { getProfileBundleByUserId: async () => ({ profile: { ...profile, userId: "another" }, providerProfile: null }) } as unknown as Repository;
  assert.equal(await resolveUserSession(provider, mismatch), null);
});

test("auth inputs are bounded and the unconfigured provider never authenticates", async () => {
  assert.deepEqual(credentialsSchema.parse({ email: "PERSON@EXAMPLE.COM", password: "password-only" }).email, "person@example.com");
  assert.equal(credentialsSchema.safeParse({ email: "bad", password: "short" }).success, false);
  assert.equal(signupSchema.safeParse({ email: "person@example.test", password: "password-only", displayName: " ".repeat(2) }).success, false);
  assert.equal(confirmationSchema.safeParse({ tokenHash: "hash", type: "signup" }).success, false);
  assert.equal(await unconfiguredAuthProvider.currentIdentity(), null);
  assert.deepEqual(await unconfiguredAuthProvider.signIn({ email: "person@example.test", password: "password-only" }), { ok: false, reason: "UNAVAILABLE" });
  assert.deepEqual(await unconfiguredAuthProvider.signUp({ email: "person@example.test", password: "password-only", displayName: "Person" }), { ok: false, reason: "UNAVAILABLE" });
  assert.deepEqual(await unconfiguredAuthProvider.requestPasswordReset({ email: "person@example.test", redirectTo: "https://app.example.test/auth/recovery" }), { ok: false, reason: "UNAVAILABLE" });
  assert.deepEqual(await unconfiguredAuthProvider.establishPasswordRecovery({ tokenHash: "recovery-token" }), { ok: false, reason: "UNAVAILABLE" });
  assert.deepEqual(await unconfiguredAuthProvider.updatePassword("replacement-password"), { ok: false, reason: "UNAVAILABLE" });
  assert.equal(await unconfiguredAuthProvider.verifyEmail("hash"), false);
});

test("password recovery input and redirect origins fail closed", () => {
  assert.equal(passwordRecoveryRequestSchema.parse({ email: "PERSON@EXAMPLE.COM" }).email, "person@example.com");
  assert.equal(passwordUpdateSchema.safeParse({ password: "replacement-password", confirmPassword: "different-password" }).success, false);
  assert.equal(passwordUpdateSchema.safeParse({ password: "replacement-password", confirmPassword: "replacement-password" }).success, true);
  assert.deepEqual(recoveryCallbackSchema.parse({ code: "pkce-code" }), { code: "pkce-code" });
  assert.deepEqual(recoveryCallbackSchema.parse({ tokenHash: "recovery-token", type: "recovery" }), { tokenHash: "recovery-token", type: "recovery" });
  assert.equal(resolveApplicationOrigin({ NEXT_PUBLIC_APP_URL: "https://app.example.test/path" }), "https://app.example.test");
  assert.equal(resolveApplicationOrigin({ NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3000" }), "http://127.0.0.1:3000");
  assert.throws(() => resolveApplicationOrigin({}), /not configured/);
  assert.throws(() => resolveApplicationOrigin({ NEXT_PUBLIC_APP_URL: "http://app.example.test" }), /HTTPS/);
  assert.throws(() => resolveApplicationOrigin({ NEXT_PUBLIC_APP_URL: "not a URL" }), /invalid/);
});
