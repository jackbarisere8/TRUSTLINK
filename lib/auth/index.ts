import "server-only";
import { cache } from "react";
import { redirect, notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getAuthProvider } from "./provider";
import { resolveUserSession } from "./session";
export type { UserSession } from "./session";
export { resolveUserSession } from "./session";
export const getCurrentUser = cache(() => resolveUserSession(getAuthProvider(), db));
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
