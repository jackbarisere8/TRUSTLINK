export class DomainError extends Error {}
export class ConflictError extends DomainError {
  constructor() { super("This record changed while you were working. Refresh and try again."); }
}
export function publicError(error: unknown) {
  return error instanceof DomainError ? error.message : "We couldn't save this change. Please try again.";
}
