export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const evidenceContentTypes = ["application/pdf","image/jpeg","image/png","image/webp","text/plain"] as const;
export type EvidenceContentType = typeof evidenceContentTypes[number];
const evidenceExtensions: Record<EvidenceContentType,string> = {
  "application/pdf": ".pdf",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "text/plain": ".txt",
};
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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
  if (claimed === "application/pdf") {
    const tail = Buffer.from(bytes.slice(Math.max(0,bytes.length-2048))).toString("latin1");
    return bytes.length >= 10 && Buffer.from(bytes.slice(0,5)).toString() === "%PDF-" && tail.includes("%%EOF");
  }
  if (claimed === "image/png") {
    return bytes.length >= 20 && Buffer.from(bytes.slice(0,8)).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      Buffer.from(bytes.slice(-12)).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130]));
  }
  if (claimed === "image/jpeg") return bytes.length >= 5 && bytes[0]===255 && bytes[1]===216 && bytes[2]===255 && bytes.at(-2)===255 && bytes.at(-1)===217;
  if (claimed === "image/webp") {
    return bytes.length >= 12 && Buffer.from(bytes.slice(0,4)).toString()==="RIFF" &&
      Buffer.from(bytes.slice(8,12)).toString()==="WEBP" && Buffer.from(bytes).readUInt32LE(4)===bytes.length-8;
  }
  if (claimed === "text/plain") {
    try {
      const decoded = new TextDecoder("utf-8",{fatal:true}).decode(bytes);
      const beginning = decoded.replace(/^\uFEFF/,"").trimStart().slice(0,1024).toLowerCase();
      return !bytes.includes(0) && !beginning.startsWith("#!") && !/<(?:svg|script|html)\b|<!doctype\s+html/.test(beginning);
    } catch { return false; }
  }
  return false;
}
export function safeEvidenceFilename(filename: string, contentType: EvidenceContentType) {
  const extension = evidenceExtensions[contentType];
  const normalized = filename.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f/\\:*?"<>|\u202a-\u202e\u2066-\u2069]/g,"_")
    .trim().replace(/^\.+/,"");
  let base = normalized.replace(/\.[a-z0-9]{1,10}$/i,"").trim().replace(/[. ]+$/g,"") || "attachment";
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) base = "_" + base;
  return base.slice(0,200-extension.length).replace(/[. ]+$/g,"") + extension;
}
export function isEvidencePathForJob(jobId: string, storagePath: string) {
  const [pathJobId,objectId,...rest] = storagePath.split("/");
  return rest.length === 0 && pathJobId === jobId && uuidPattern.test(pathJobId) && uuidPattern.test(objectId || "");
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
