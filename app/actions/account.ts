"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { enableProviderProfile, updateAccount } from "@/lib/domain/accounts";
import { publicError } from "@/lib/domain/errors";

export async function updateAccountAction(input: unknown) {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to update your account." };
  if (user.role === "ADMIN") return { error: "This action is not available to administrator accounts." };
  try {
    await updateAccount(db, user.userId, input);
  } catch (error) {
    return { error: publicError(error) };
  }
  revalidatePath("/account");
  revalidatePath("/account/settings");
  revalidatePath("/dashboard");
  revalidatePath("/p/" + user.username);
  return { message: "Account details saved." };
}

export async function enableProviderAction(input: unknown) {
  const user = await getCurrentUser();
  if (!user) return { error: "Log in to become a provider." };
  if (user.role === "ADMIN") return { error: "Administrator accounts cannot enable a provider workspace." };
  try {
    await enableProviderProfile(db, user.userId, input);
  } catch (error) {
    return { error: publicError(error) };
  }
  revalidatePath("/account");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  redirect("/dashboard/profile");
}
