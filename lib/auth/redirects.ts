export function resolveApplicationOrigin(env: Record<string, string | undefined> = process.env) {
  const configured = env.NEXT_PUBLIC_APP_URL?.trim();
  if (!configured) throw new Error("Application URL is not configured.");

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("Application URL is invalid.");
  }

  const loopback = url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
    throw new Error("Application URL requires HTTPS except on loopback development services.");
  }
  return url.origin;
}

/** Accept only an application-relative path at the post-auth redirect boundary. */
export function safeReturnPath(value: unknown, fallback: string) {
  if (typeof value !== "string" || value.length === 0 || value.length > 800) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  try {
    const parsed = new URL(value, "https://trustlink.local");
    if (parsed.origin !== "https://trustlink.local") return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}
