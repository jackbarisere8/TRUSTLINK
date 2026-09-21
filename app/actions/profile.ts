"use server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateProviderProfile } from "@/lib/domain/profiles";
import { publicError } from "@/lib/domain/errors";
import { revalidatePath } from "next/cache";
export async function updateProfileAction(input: unknown) {
  const user = await getCurrentUser();
  if (!user) return {error:"Log in to edit your profile."};
  try { await updateProviderProfile(db,user.userId,input); }
  catch (error) { return {error:publicError(error)}; }
  revalidatePath("/dashboard/profile"); revalidatePath("/p/"+user.username);
  return {message:"Profile saved."};
}
