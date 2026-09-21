"use server";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getAuthProvider } from "@/lib/auth/provider";
import { credentialsSchema, signupSchema } from "@/lib/auth/schemas";
const unavailable = "Account access is not configured on this installation. You can still explore the example transaction.";
export async function loginAction(form: FormData) {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter a valid email and a password of at least 8 characters." };
  const result = await getAuthProvider().signIn(parsed.data);
  if (!result.ok) return { error: result.reason === "UNAVAILABLE" ? unavailable : "We couldn't sign you in. Check your credentials and email confirmation." };
  redirect("/dashboard");
}
export async function signupAction(form: FormData) {
  const parsed = signupSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your name, a valid email, and a password of at least 8 characters." };
  const result = await getAuthProvider().signUp(parsed.data);
  if (!result.ok) return { error: result.reason === "UNAVAILABLE" ? unavailable : "We couldn't create the account. Try again or sign in if you already have one." };
  if (!result.session) return { message: "Check your email to confirm your account, then log in." };
  redirect("/dashboard");
}
export async function logoutAction() {
  await getAuthProvider().signOut();
  // Removed from authentication long ago; clear it so legacy data cannot look like a live session.
  (await cookies()).delete("tl_session_token");
  redirect("/login");
}
