"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { authorizedJob, capabilityCookie } from "@/lib/jobs";
import { validCapability } from "@/lib/domain/participants";
import { TransactionService } from "@/lib/domain/transactions";
import { DomainError, publicError } from "@/lib/domain/errors";
import { commandSchema } from "@/lib/validation";
import { validateEvidenceReferences } from "@/lib/storage";
const transactions = new TransactionService(db);
export async function createJobAction(input: unknown) {
  try {
    const user = await getCurrentUser();
    if (!user) throw new DomainError("Log in to create a transaction.");
    const { aggregate, token } = await transactions.create({ id: user.userId, type: "PROVIDER", name: user.displayName }, input);
    revalidatePath("/dashboard");
    return { success: true as const, publicUrl: "/j/" + aggregate.job.publicId, jobId: aggregate.job.id,
      clientShareUrl: token ? "/j/" + aggregate.job.publicId + "#invite=" + token : undefined };
  } catch(error) { return { success: false as const, error: publicError(error) }; }
}
export async function claimClientLinkAction(publicId: string, token: string) {
  try {
    const a = await db.getAggregate(publicId, true);
    if (!a || !validCapability(a.job, token)) throw new DomainError("This participant link is invalid or expired. Ask the provider for a new link.");
    (await cookies()).set(capabilityCookie(publicId), token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", expires: new Date(a.job.clientTokenExpiresAt!) });
    revalidatePath("/j/" + publicId);
    return { success: true as const };
  } catch(error) { return { success: false as const, error: publicError(error) }; }
}
export async function acceptJobAction(publicId: string, input: unknown, expectedVersion: number, requestId: string) {
  try {
    const { actor } = await authorizedJob(publicId, true);
    if (actor.type !== "CLIENT_PARTICIPANT") throw new DomainError("Only the client participant can accept this agreement.");
    const token = (await cookies()).get(capabilityCookie(publicId))?.value || "";
    await transactions.accept(publicId, token, input, { id: requestId, expectedVersion });
    revalidatePath("/dashboard"); revalidatePath("/dashboard/jobs");
    revalidatePath("/j/" + publicId);
    return { success: true as const };
  } catch(error) { return { success: false as const, error: publicError(error) }; }
}
export async function jobCommandAction(jobId: string, input: unknown, expectedVersion: number, requestId: string) {
  try {
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) throw new DomainError("Check the fields and try again.");
    const { aggregate: a, actor } = await authorizedJob(jobId);
    if ("files" in parsed.data) await validateEvidenceReferences(a.job.id, actor.id, parsed.data.files);
    const capability = actor.type === "CLIENT_PARTICIPANT" ? (await cookies()).get(capabilityCookie(a.job.publicId))?.value : undefined;
    const { token, replayed } = await transactions.execute(jobId, actor, parsed.data, { id: requestId, expectedVersion }, capability);
    revalidatePath("/dashboard"); revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard/jobs/" + a.job.id); revalidatePath("/j/" + a.job.publicId);
    revalidatePath("/disputes/" + a.job.id); revalidatePath("/admin");
    return { success: true as const, replayed, clientShareUrl: token ? "/j/" + a.job.publicId + "#invite=" + token : undefined };
  } catch(error) { return { success: false as const, error: publicError(error) }; }
}
