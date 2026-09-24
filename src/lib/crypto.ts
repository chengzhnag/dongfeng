// Cloudflare Workers Web Crypto currently rejects iteration counts above 100000.
const PBKDF2_ITERATIONS = 100000;

export async function generateVerificationHash(seed: string, title: string, winnerId: string, optionsJson: string): Promise<string> {
  const data = new TextEncoder().encode(`DONGFENG_VERIFY::${seed}::${title}::${winnerId}::${optionsJson}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function generateId(prefix = ""): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const value = Array.from(bytes)
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
  return prefix ? `${prefix}_${value}` : value;
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), character => character.charCodeAt(0));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${base64UrlEncode(salt)}$${base64UrlEncode(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, iterationsText, saltText, hashText] = encoded.split("$");
  const iterations = Number(iterationsText);
  if (algorithm !== "pbkdf2" || !Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS || !saltText || !hashText) return false;

  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const salt = base64UrlDecode(saltText);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.buffer as ArrayBuffer, iterations, hash: "SHA-256" },
    key,
    256
  );
  return base64UrlEncode(new Uint8Array(bits)) === hashText;
}
