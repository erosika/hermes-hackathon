import { expect, test, describe, beforeEach } from "bun:test";
import { checkFreeTier, FREE, __resetRateLimitForTest } from "./ratelimit";

const SECRET = "test-jwt-secret";
process.env.SUPABASE_JWT_SECRET = SECRET;

const bytesToB64url = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
const strToB64url = (s: string) => bytesToB64url(new TextEncoder().encode(s));

async function makeJwt(payload: Record<string, unknown>, sec = SECRET): Promise<string> {
  const header = strToB64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = strToB64url(JSON.stringify(payload));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(sec), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${header}.${body}`));
  return `${header}.${body}.${bytesToB64url(new Uint8Array(sig))}`;
}

const bearer = (token?: string) =>
  new Request("http://x/v1", token ? { headers: { authorization: `Bearer ${token}` } } : undefined);

describe("supabase jwt", () => {
  test("verifies a valid token → identity (email lowercased)", async () => {
    const { readIdentity } = await import("./auth");
    const jwt = await makeJwt({ sub: "u1", email: "Eri@X", exp: Math.floor(Date.now() / 1000) + 3600 });
    const id = await readIdentity(bearer(jwt));
    expect(id?.email).toBe("eri@x");
    expect(id?.sub).toBe("u1");
  });

  test("rejects a token signed with the wrong secret", async () => {
    const { readIdentity } = await import("./auth");
    const jwt = await makeJwt({ sub: "u1", email: "a@b" }, "not-the-secret");
    expect(await readIdentity(bearer(jwt))).toBeNull();
  });

  test("rejects an expired token", async () => {
    const { readIdentity } = await import("./auth");
    const jwt = await makeJwt({ sub: "u1", email: "a@b", exp: 1 });
    expect(await readIdentity(bearer(jwt))).toBeNull();
  });

  test("no bearer → null", async () => {
    const { readIdentity } = await import("./auth");
    expect(await readIdentity(bearer())).toBeNull();
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
