"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { authClient, authConfigured } from "@/lib/auth/client";
const unavailable = "Account access is not configured on this installation. You can still explore the example transaction.";
const credentials = z.object({ email: z.email().max(254), password: z.string().min(8).max(128) });
export async function loginAction(form: FormData) {
  if (!authConfigured()) return { error: unavailable };
  const parsed = credentials.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };
  const client = await authClient();
  const { error } = await client.auth.signInWithPassword(parsed.data);
  if (error) return { error: "We couldn't sign you in. Check your credentials and email confirmation." };
  redirect("/dashboard");
}
export async function signupAction(form: FormData) {
  if (!authConfigured()) return { error: unavailable };
  const parsed = credentials.extend({ displayName: z.string().trim().min(2).max(120), profession: z.string().trim().max(160).optional() }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your name, a valid email, and a password of at least 8 characters." };
  const client = await authClient();
  const { data, error } = await client.auth.signUp({ email: parsed.data.email, password: parsed.data.password, options: { data: { display_name: parsed.data.displayName, headline: parsed.data.profession || "Independent professional" } } });
  if (error) return { error: "We couldn't create the account. Try again or sign in if you already have one." };
  if (!data.session) return { message: "Check your email to confirm your account, then log in." };
  redirect("/dashboard");
}
export async function logoutAction() {
  if (authConfigured()) await (await authClient()).auth.signOut();
  (await cookies()).delete("tl_session_token");
  redirect("/login");
}
