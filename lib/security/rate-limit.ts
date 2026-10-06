import "server-only";

import { createHash } from "node:crypto";

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
}

export interface RateLimitDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

interface Bucket {
  count: number;
  resetAt: number;
}

const MAX_BUCKETS = 10_000;

function bucketKey(scope: string, identifier: string) {
  return createHash("sha256").update(scope).update("\0").update(identifier).digest("hex");
}

export class MemoryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  constructor(private readonly maxBuckets = MAX_BUCKETS) {}

  take(scope: string, identifier: string, policy: RateLimitPolicy, now = Date.now()): RateLimitDecision {
    if (!Number.isInteger(policy.limit) || policy.limit < 1 || !Number.isFinite(policy.windowMs) || policy.windowMs < 1) {
      throw new Error("Invalid rate-limit policy.");
    }

    if (now - this.lastSweep >= 60_000 || this.buckets.size >= this.maxBuckets) {
      for (const [key, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(key);
      }
      this.lastSweep = now;
    }

    const key = bucketKey(scope, identifier);
    let bucket = this.buckets.get(key);
    if (!bucket && this.buckets.size >= this.maxBuckets) {
      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil(policy.windowMs / 1000)),
      };
    }

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + policy.windowMs };
      this.buckets.set(key, bucket);
    }

    if (bucket.count >= policy.limit) {
      return {
        allowed: false,
        limit: policy.limit,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - bucket.count),
      retryAfterSeconds: 0,
    };
  }
}

const globalLimiterKey = Symbol.for("trustlink.application-rate-limiter");
const globalWithLimiter = globalThis as typeof globalThis & { [globalLimiterKey]?: MemoryRateLimiter };
const applicationRateLimiter = globalWithLimiter[globalLimiterKey] ?? new MemoryRateLimiter();
globalWithLimiter[globalLimiterKey] = applicationRateLimiter;

export const rateLimitPolicies = {
  authLoginAddress: { limit: 30, windowMs: 15 * 60_000 },
  authLoginAccount: { limit: 10, windowMs: 15 * 60_000 },
  authSignupAddress: { limit: 10, windowMs: 60 * 60_000 },
  authSignupAccount: { limit: 3, windowMs: 60 * 60_000 },
  authRecoveryAddress: { limit: 10, windowMs: 60 * 60_000 },
  authRecoveryAccount: { limit: 3, windowMs: 60 * 60_000 },
  authCallbackAddress: { limit: 20, windowMs: 15 * 60_000 },
  authPasswordUpdate: { limit: 5, windowMs: 15 * 60_000 },
  capabilityAddress: { limit: 30, windowMs: 15 * 60_000 },
  capabilityRecord: { limit: 10, windowMs: 15 * 60_000 },
  transactionAddress: { limit: 120, windowMs: 5 * 60_000 },
  transactionRecord: { limit: 40, windowMs: 5 * 60_000 },
  evidenceAddress: { limit: 30, windowMs: 15 * 60_000 },
  evidenceRecord: { limit: 15, windowMs: 15 * 60_000 },
} satisfies Record<string, RateLimitPolicy>;

export function consumeRateLimit(scope: string, identifier: string, policy: RateLimitPolicy) {
  return applicationRateLimiter.take(scope, identifier, policy);
}

export function consumeRateLimits(
  inputs: Array<{ scope: string; identifier: string; policy: RateLimitPolicy }>,
): RateLimitDecision {
  let remaining = Number.MAX_SAFE_INTEGER;
  let limit = Number.MAX_SAFE_INTEGER;
  let retryAfterSeconds = 0;

  for (const input of inputs) {
    const decision = consumeRateLimit(input.scope, input.identifier, input.policy);
    remaining = Math.min(remaining, decision.remaining);
    limit = Math.min(limit, decision.limit);
    retryAfterSeconds = Math.max(retryAfterSeconds, decision.retryAfterSeconds);
    if (!decision.allowed) return { allowed: false, limit, remaining: 0, retryAfterSeconds };
  }

  return { allowed: true, limit, remaining, retryAfterSeconds: 0 };
}
