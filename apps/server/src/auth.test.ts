import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { checkFreeTier, FREE, __resetRateLimitForTest } from "./ratelimit";

process.env.SUPABASE_URL = "http://sb.test";
process.env.SUPABASE_ANON_KEY = "anon-test";

const bearer = (token?: string) =>
  new Request("http://x/v1", token ? { headers: { authorization: `Bearer ${token}` } } : undefined);
const origFetch = globalThis.fetch;

describe("supabase token verification", () => {
  beforeEach(async () => {
    const { __clearAuthCacheForTest } = await import("./auth");
    __clearAuthCacheForTest();
  });
  afterEach(() => { globalThis.fetch = origFetch; });

  test("valid token → identity (email lowercased), calls /auth/v1/user with apikey", async () => {
    let seen = "";
    globalThis.fetch = (async (u: string | URL | Request, init?: RequestInit) => {
      seen = String(u);
      const apikey = (init?.headers as Record<string, string>)?.apikey;
      expect(apikey).toBe("anon-test");
      return new Response(JSON.stringify({ id: "u1", email: "Eri@X" }), { status: 200 });
    }) as typeof fetch;
    const { readIdentity } = await import("./auth");
    const id = await readIdentity(bearer("tok"));
    expect(seen).toBe("http://sb.test/auth/v1/user");
    expect(id?.email).toBe("eri@x");
    expect(id?.sub).toBe("u1");
  });

  test("supabase rejects (401) → null", async () => {
    globalThis.fetch = (async () => new Response("no", { status: 401 })) as typeof fetch;
    const { readIdentity } = await import("./auth");
    expect(await readIdentity(bearer("bad"))).toBeNull();
  });

  test("no bearer → null, no supabase call", async () => {
    let called = false;
    globalThis.fetch = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
    const { readIdentity } = await import("./auth");
    expect(await readIdentity(bearer())).toBeNull();
    expect(called).toBe(false);
  });
});

describe("free tier", () => {
  beforeEach(() => __resetRateLimitForTest());

  test("allows up to the lifetime cap then blocks", () => {
    let last = checkFreeTier("id-a", "1.1.1.1");
    for (let i = 1; i < FREE.lifetime; i++) last = checkFreeTier("id-a", "1.1.1.1");
    expect(last.allowed).toBe(true);
    expect(last.remaining).toBe(0);
    expect(checkFreeTier("id-a", "1.1.1.1").allowed).toBe(false);
  });

  test("daily IP cap blocks distinct identities sharing an IP", () => {
    for (let i = 0; i < FREE.daily; i++) checkFreeTier(`id-${i}`, "9.9.9.9");
    expect(checkFreeTier("id-new", "9.9.9.9").allowed).toBe(false);
  });
});
