import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { authClient, authConfigured } from "./client";
export interface UserSession { userId: string; email: string; username: string; displayName: string; role: "PROVIDER" | "ADMIN" }
export const getCurrentUser = cache(async (): Promise<UserSession | null> => {
  if (!authConfigured()) return null;
  const client = await authClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  const profile = await db.getProfileByUserId(user.id);
  if (!profile) return null;
  return { userId: user.id, email: user.email || "", username: profile.username, displayName: profile.displayName, role: user.app_metadata?.role === "ADMIN" ? "ADMIN" : "PROVIDER" };
});
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") notFound();
  return user;
}
