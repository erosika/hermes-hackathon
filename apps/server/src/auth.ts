// real auth — verify the Supabase-issued JWT on the Authorization header.
// no cookie, no shared password: the client signs in via Supabase (magic link / OTP),
// gets a JWT, and sends it as `Bearer <token>`. we verify HS256 against the project's
// JWT secret and trust the email/sub inside. set SUPABASE_JWT_SECRET (Supabase → API → JWT Secret).

export interface Identity {
  email: string;
  sub: string; // supabase user id
}

const enc = (s: string) => new TextEncoder().encode(s);
const secret = () => process.env.SUPABASE_JWT_SECRET;

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const b64 = s.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

let cached: { secret: string; key: CryptoKey } | null = null;
async function key(sec: string): Promise<CryptoKey> {
  if (cached?.secret === sec) return cached.key;
  const k = await crypto.subtle.importKey("raw", enc(sec), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  cached = { secret: sec, key: k };
  return k;
}

export function authConfigured(): boolean {
  return !!secret();
}

export async function readIdentity(request: Request): Promise<Identity | null> {
  const sec = secret();
  if (!sec) return null; // auth not wired — no trusted identity
  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const [h, p, s] = token.split(".");
  if (!h || !p || !s) return null;

  try {
    const ok = await crypto.subtle.verify("HMAC", await key(sec), b64urlToBytes(s), enc(`${h}.${p}`));
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(p))) as {
      email?: string;
      sub?: string;
      exp?: number;
      user_metadata?: { email?: string };
    };
    if (payload.exp && Date.now() / 1000 > payload.exp) return null; // expired
    const email = payload.email ?? payload.user_metadata?.email;
    if (!email || !payload.sub) return null;
    return { email: String(email).toLowerCase(), sub: String(payload.sub) };
  } catch {
    return null;
  }
}
