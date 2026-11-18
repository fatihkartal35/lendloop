// HMAC-SHA256 over `${timestamp}.${body}`, hex encoded.
// Used to sign calls to n8n and to verify calls coming back from n8n.

const enc = new TextEncoder();
export const MAX_SKEW_MS = 5 * 60 * 1000;

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

export async function sign(secret: string, timestamp: string, body: string) {
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(`${timestamp}.${body}`));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function verify(
  secret: string,
  timestamp: string | null,
  signature: string | null,
  body: string,
): Promise<boolean> {
  if (!timestamp || !signature) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) return false;
  return safeEqual(await sign(secret, timestamp, body), signature);
}

export function secret(): string {
  const s = process.env.N8N_SHARED_SECRET;
  if (!s) throw new Error("N8N_SHARED_SECRET is not set");
  return s;
}
