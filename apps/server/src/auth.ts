// real auth — the client signs in via Supabase (magic link / OTP) and sends its access
// token as `Bearer <token>`. we verify by asking Supabase who the token belongs to
// (GET /auth/v1/user). needs only SUPABASE_URL + SUPABASE_ANON_KEY (neither secret,
// both CLI-gettable), and works regardless of the project's JWT signing scheme.

export interface Identity {
  email: string;
  sub: string; // supabase user id
}

const url = () => process.env.SUPABASE_URL;
const anon = () => process.env.SUPABASE_ANON_KEY;

export function authConfigured(): boolean {
  return !!(url() && anon());
}

// short cache so a burst of calls with the same token doesn't hit Supabase each time.
const cache = new Map<string, { id: Identity | null; exp: number }>();

export async function readIdentity(request: Request): Promise<Identity | null> {
  const base = url();
  const key = anon();
  if (!base || !key) return null;

  const header = request.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return null;

  const now = Date.now();
  const hit = cache.get(token);
  if (hit && hit.exp > now) return hit.id;

  try {
    const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: key, authorization: `Bearer ${token}` } });
    if (!r.ok) {
      cache.set(token, { id: null, exp: now + 15_000 });
      return null;
    }
    const u = (await r.json()) as { id?: string; email?: string };
    const id = u.email && u.id ? { email: String(u.email).toLowerCase(), sub: String(u.id) } : null;
    cache.set(token, { id, exp: now + 60_000 });
    return id;
  } catch {
    return null;
  }
}

export function __clearAuthCacheForTest(): void {
  cache.clear();
}
