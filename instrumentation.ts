import type { Instrumentation } from "next";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.NEXT_PHASE !== "phase-production-build") {
    const { storageMode } = await import("./lib/db");
    storageMode();
  }
}

export const onRequestError: Instrumentation.onRequestError = async (error, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordOperationalEvent } = await import("./lib/observability");
  const digest = typeof error === "object" && error !== null && "digest" in error
    ? String(error.digest)
    : undefined;
  recordOperationalEvent({
    event: "request.error",
    outcome: "failure",
    method: request.method,
    route: context.routePath,
    operation: context.routeType,
    digest,
  });
};
