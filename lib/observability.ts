import "server-only";

export type OperationalOutcome = "success" | "rejected" | "rate_limited" | "failure";

export interface OperationalEvent {
  event:
    | "auth.login"
    | "auth.signup"
    | "auth.recovery.request"
    | "auth.recovery.complete"
    | "auth.confirm"
    | "capability.exchange"
    | "transaction.create"
    | "transaction.accept"
    | "transaction.command"
    | "evidence.upload"
    | "evidence.delete"
    | "request.error";
  outcome: OperationalOutcome;
  operation?: string;
  route?: string;
  method?: string;
  status?: number;
  retryAfterSeconds?: number;
  digest?: string;
}

function safeLabel(value: string | undefined, maximum: number) {
  if (!value) return undefined;
  const normalized = value.replace(/[^a-zA-Z0-9_./:-]/g, "_").slice(0, maximum);
  return normalized || undefined;
}

function safeRoute(value: string | undefined) {
  return safeLabel(value?.split(/[?#]/, 1)[0], 160);
}

export function operationalEventPayload(event: OperationalEvent, occurredAt = new Date()) {
  return {
    timestamp: occurredAt.toISOString(),
    event: event.event,
    outcome: event.outcome,
    ...(safeLabel(event.operation, 80) ? { operation: safeLabel(event.operation, 80) } : {}),
    ...(safeRoute(event.route) ? { route: safeRoute(event.route) } : {}),
    ...(safeLabel(event.method, 12) ? { method: safeLabel(event.method, 12) } : {}),
    ...(Number.isInteger(event.status) ? { status: event.status } : {}),
    ...(Number.isInteger(event.retryAfterSeconds) ? { retryAfterSeconds: event.retryAfterSeconds } : {}),
    ...(safeLabel(event.digest, 128) ? { digest: safeLabel(event.digest, 128) } : {}),
  };
}

export function recordOperationalEvent(event: OperationalEvent) {
  console.info("[trustlink:operational]", JSON.stringify(operationalEventPayload(event)));
}
