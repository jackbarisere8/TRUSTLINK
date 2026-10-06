import { test } from "node:test";
import assert from "node:assert/strict";
import { MemoryRateLimiter } from "../lib/security/rate-limit";
import { buildSecurityHeaders } from "../lib/security/headers";
import { operationalEventPayload } from "../lib/observability";
import { CAREER_TAXONOMY } from "../lib/discovery/careers";
import { SAMPLE_OPPORTUNITIES } from "../lib/opportunities";

test("rate limiter blocks excess attempts, resets windows, and fails closed at capacity", () => {
  const limiter = new MemoryRateLimiter(1);
  const policy = { limit: 2, windowMs: 1_000 };

  assert.deepEqual(limiter.take("auth", "person@example.test", policy, 1), {
    allowed: true,
    limit: 2,
    remaining: 1,
    retryAfterSeconds: 0,
  });
  assert.equal(limiter.take("auth", "person@example.test", policy, 2).allowed, true);
  assert.deepEqual(limiter.take("auth", "person@example.test", policy, 3), {
    allowed: false,
    limit: 2,
    remaining: 0,
    retryAfterSeconds: 1,
  });
  assert.equal(limiter.take("auth", "another@example.test", policy, 3).allowed, false);
  assert.equal(limiter.take("auth", "another@example.test", policy, 1_002).allowed, true);
});

test("security headers enforce framing, MIME, referrer and production transport policy", () => {
  const development = new Map(buildSecurityHeaders("development").map(header => [header.key, header.value]));
  const production = new Map(buildSecurityHeaders("production").map(header => [header.key, header.value]));

  assert.match(development.get("Content-Security-Policy") || "", /frame-ancestors 'none'/);
  assert.match(development.get("Content-Security-Policy") || "", /'unsafe-eval'/);
  assert.doesNotMatch(production.get("Content-Security-Policy") || "", /'unsafe-eval'/);
  assert.match(production.get("Content-Security-Policy") || "", /upgrade-insecure-requests/);
  assert.equal(production.get("Strict-Transport-Security"), "max-age=31536000");
  assert.equal(development.has("Strict-Transport-Security"), false);
  assert.equal(production.get("X-Frame-Options"), "DENY");
  assert.equal(production.get("X-Content-Type-Options"), "nosniff");
  assert.equal(production.get("Referrer-Policy"), "no-referrer");
});

test("operational events retain allowlisted diagnostics without URL secrets", () => {
  const payload = operationalEventPayload({
    event: "request.error",
    outcome: "failure",
    route: "/api/evidence/job-id?token=private-evidence-token",
    method: "POST\nInjected",
    status: 500,
    digest: "digest-123",
  }, new Date("2026-10-04T10:00:00.000Z"));

  assert.deepEqual(payload, {
    timestamp: "2026-10-04T10:00:00.000Z",
    event: "request.error",
    outcome: "failure",
    route: "/api/evidence/job-id",
    method: "POST_Injecte",
    status: 500,
    digest: "digest-123",
  });
  assert.doesNotMatch(JSON.stringify(payload), /private-evidence-token/);
});

test("discovery examples use canonical career slugs and disclose synthetic provenance", () => {
  const canonicalSlugs = new Set(CAREER_TAXONOMY.map(career => career.slug));
  for (const opportunity of SAMPLE_OPPORTUNITIES) {
    assert.equal(canonicalSlugs.has(opportunity.careerSlug), true, opportunity.careerSlug);
    assert.equal(opportunity.provenance.sourceName, "TrustLink synthetic example");
    assert.equal(opportunity.provenance.sourceUrl, "/opportunities");
    assert.equal(opportunity.status, "UNVERIFIED");
  }
  for (const career of CAREER_TAXONOMY) {
    assert.equal("typicalIncomeRange" in career, false);
    assert.equal("trendSignal" in career, false);
    assert.equal("typicalEmployers" in career, false);
  }
});
