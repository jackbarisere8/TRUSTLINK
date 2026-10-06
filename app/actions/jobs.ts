"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { authorizedJob, capabilityCookie } from "@/lib/jobs";
import { TransactionService } from "@/lib/domain/transactions";
import { DomainError, publicError } from "@/lib/domain/errors";
import { commandSchema } from "@/lib/validation";
import { validateEvidenceReferences } from "@/lib/storage";
import { consumeRateLimits, rateLimitPolicies } from "@/lib/security/rate-limit";
import { currentClientAddress } from "@/lib/security/request";
import { recordOperationalEvent } from "@/lib/observability";

const transactions = new TransactionService(db);

async function transactionAddressLimit() {
  const address = await currentClientAddress();
  return consumeRateLimits([
    { scope: "transaction.mutation.address", identifier: address, policy: rateLimitPolicies.transactionAddress },
  ]);
}

function transactionRecordLimit(recordId: string) {
  return consumeRateLimits([
    { scope: "transaction.mutation.record", identifier: recordId, policy: rateLimitPolicies.transactionRecord },
  ]);
}

const transactionLimited = "Too many transaction changes. Wait a few minutes and try again.";

export async function createJobAction(input: unknown) {
  try {
    const limit = await transactionAddressLimit();
    if (!limit.allowed) {
      recordOperationalEvent({ event: "transaction.create", outcome: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds });
      return { success: false as const, error: transactionLimited };
    }
    const user = await getCurrentUser();
    if (!user) throw new DomainError("Log in to create a transaction.");
    if (user.role !== "PROVIDER") throw new DomainError("A provider account is required to create a transaction.");
    const { aggregate, token } = await transactions.create({ id: user.userId, type: "PROVIDER", name: user.displayName }, input);
    revalidatePath("/dashboard");
    recordOperationalEvent({ event: "transaction.create", outcome: "success" });
    return { success: true as const, publicUrl: "/j/" + aggregate.job.publicId, jobId: aggregate.job.id,
      clientShareUrl: token ? "/j/" + aggregate.job.publicId + "#invite=" + token : undefined };
  } catch(error) {
    recordOperationalEvent({ event: "transaction.create", outcome: error instanceof DomainError ? "rejected" : "failure" });
    return { success: false as const, error: publicError(error) };
  }
}
export async function acceptJobAction(publicId: string, input: unknown, expectedVersion: number, requestId: string) {
  try {
    const addressLimit = await transactionAddressLimit();
    if (!addressLimit.allowed) {
      recordOperationalEvent({ event: "transaction.accept", outcome: "rate_limited", retryAfterSeconds: addressLimit.retryAfterSeconds });
      return { success: false as const, error: transactionLimited };
    }
    const { actor } = await authorizedJob(publicId, true);
    const recordLimit = transactionRecordLimit(publicId);
    if (!recordLimit.allowed) {
      recordOperationalEvent({ event: "transaction.accept", outcome: "rate_limited", retryAfterSeconds: recordLimit.retryAfterSeconds });
      return { success: false as const, error: transactionLimited };
    }
    if (actor.type !== "CLIENT_PARTICIPANT") throw new DomainError("Only the client participant can accept this agreement.");
    const token = (await cookies()).get(capabilityCookie(publicId))?.value || "";
    await transactions.accept(publicId, token, input, { id: requestId, expectedVersion });
    revalidatePath("/dashboard"); revalidatePath("/dashboard/jobs");
    revalidatePath("/j/" + publicId);
    recordOperationalEvent({ event: "transaction.accept", outcome: "success" });
    return { success: true as const };
  } catch(error) {
    recordOperationalEvent({ event: "transaction.accept", outcome: error instanceof DomainError ? "rejected" : "failure" });
    return { success: false as const, error: publicError(error) };
  }
}
export async function jobCommandAction(jobId: string, input: unknown, expectedVersion: number, requestId: string) {
  try {
    const addressLimit = await transactionAddressLimit();
    if (!addressLimit.allowed) {
      recordOperationalEvent({ event: "transaction.command", outcome: "rate_limited", retryAfterSeconds: addressLimit.retryAfterSeconds });
      return { success: false as const, error: transactionLimited };
    }
    const parsed = commandSchema.safeParse(input);
    if (!parsed.success) throw new DomainError("Check the fields and try again.");
    const { aggregate: a, actor } = await authorizedJob(jobId);
    const recordLimit = transactionRecordLimit(jobId);
    if (!recordLimit.allowed) {
      recordOperationalEvent({ event: "transaction.command", outcome: "rate_limited", retryAfterSeconds: recordLimit.retryAfterSeconds });
      return { success: false as const, error: transactionLimited };
    }
    const capability = actor.type === "CLIENT_PARTICIPANT" ? (await cookies()).get(capabilityCookie(a.job.publicId))?.value : undefined;
    let evidenceValidation: (() => Promise<void>) | undefined;
    if (parsed.data.type === "DELIVER" || parsed.data.type === "DISPUTE") {
      const evidenceCommand = parsed.data;
      evidenceValidation = () => validateEvidenceReferences(a.job.id, actor.id, evidenceCommand.type === "DELIVER" ? "DELIVERY" : "DISPUTE", evidenceCommand.files);
    }
    const { token, replayed } = await transactions.execute(jobId, actor, parsed.data, { id: requestId, expectedVersion }, capability, evidenceValidation);
    revalidatePath("/dashboard"); revalidatePath("/dashboard/jobs");
    revalidatePath("/dashboard/jobs/" + a.job.id); revalidatePath("/j/" + a.job.publicId);
    revalidatePath("/disputes/" + a.job.id); revalidatePath("/admin");
    recordOperationalEvent({ event: "transaction.command", outcome: "success", operation: parsed.data.type });
    return { success: true as const, replayed, clientShareUrl: token ? "/j/" + a.job.publicId + "#invite=" + token : undefined };
  } catch(error) {
    recordOperationalEvent({ event: "transaction.command", outcome: error instanceof DomainError ? "rejected" : "failure" });
    return { success: false as const, error: publicError(error) };
  }
}
