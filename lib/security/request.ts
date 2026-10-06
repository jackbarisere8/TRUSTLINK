import "server-only";

import { headers } from "next/headers";

const addressHeaders = ["x-vercel-forwarded-for", "cf-connecting-ip", "x-real-ip", "x-forwarded-for"] as const;

export function clientAddressFromHeaders(source: Pick<Headers, "get">) {
  for (const name of addressHeaders) {
    const value = source.get(name)?.split(",", 1)[0]?.trim();
    if (value) return value.slice(0, 128);
  }
  // Missing proxy metadata shares one bucket. This can over-limit traffic, but
  // it cannot be used to bypass the control by omitting an address header.
  return "unknown-client";
}

export async function currentClientAddress() {
  return clientAddressFromHeaders(await headers());
}
