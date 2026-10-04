import { randomBytes } from "node:crypto";

export const publicJobIdPattern = /^[a-f0-9]{24}$/;

/** 96 bits of cryptographic randomness, encoded without revealing row identity. */
export function newPublicJobId() {
  return randomBytes(12).toString("hex");
}
