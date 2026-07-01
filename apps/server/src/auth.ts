// signed-cookie sessions — HMAC-SHA256 over the customer email, no DB, no deps.
// email-only sign-in for the demo (a magic-link/password is post-hackathon hardening);
// the cookie is tamper-proof so the gateway can trust the identity it carries.

const SECRET = process.env.SESSION_SECRET ?? "hermetika-dev-secret-change-me";
export const COOKIE_NAME = "hpx_sess";
const MAX_AGE = 60 * 60 * 24 * 30;

let keyPromise: Promise<CryptoKey> | null = null;
function key() {
  if (!keyPromise) {
    keyPromise = crypto.subtle.importKey("raw", new TextEncoder().encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  return keyPromise;
}

const b64url = (s: string) => btoa(s).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const unb64url = (s: string) => atob(s.replaceAll("-", "+").replaceAll("_", "/"));

async function hmacHex(msg: string): Promise<string> {
  const sig = await crypto.subtle.sign("HMAC", await key(), new TextEncoder().encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function signSession(email: string): Promise<string> {
  const payload = b64url(email);
  return `${payload}.${await hmacHex(payload)}`;
}

export async function readSessionEmail(cookieHeader?: string | null): Promise<string | null> {
  const raw = cookieHeader?.split(/;\s*/).find((c) => c.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!raw) return null;
  const [payload, sig] = raw.split(".");
  if (!payload || !sig) return null;
  if ((await hmacHex(payload)) !== sig) return null; // forged / tampered
  try {
    return unb64url(payload);
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  return `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}`;
}

export function clearCookie(): string {
  return `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
