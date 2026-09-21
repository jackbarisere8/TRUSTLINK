export const MAX_FILE_SIZE = 10 * 1024 * 1024;
/** Next may construct request.url with its internal hostname; Host is the browser-facing authority. */
export function hasSameOrigin(request: Request) {
  const origin = request.headers.get("origin"), host = request.headers.get("host");
  if (!origin || !host) return false;
  try {
    const expected = new URL(request.url);
    expected.host = host;
    return origin === expected.origin;
  } catch { return false; }
}
export function detectFile(bytes: Uint8Array, claimed: string) {
  if (claimed === "application/pdf" && Buffer.from(bytes.slice(0,5)).toString() === "%PDF-") return true;
  if (claimed === "image/png" && Buffer.from(bytes.slice(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return true;
  if (claimed === "image/jpeg" && bytes[0]===255 && bytes[1]===216 && bytes[2]===255) return true;
  if (claimed === "image/webp" && Buffer.from(bytes.slice(0,4)).toString()==="RIFF" && Buffer.from(bytes.slice(8,12)).toString()==="WEBP") return true;
  if (claimed === "text/plain") { try { new TextDecoder("utf-8",{fatal:true}).decode(bytes); return !bytes.includes(0); } catch { return false; } }
  return false;
}
/** Bound the bytes read, even for requests without a truthful Content-Length. */
export async function readBoundedBody(request: Request, limit = MAX_FILE_SIZE + 100000) {
  if (!request.body) throw new Error("Empty body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) { await reader.cancel(); throw new Error("Body exceeds limit"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks, total);
  } finally { reader.releaseLock(); }
}
