import { expect, test, describe, beforeEach } from "bun:test";
import { signSession, readSessionEmail, sessionCookie, COOKIE_NAME } from "./auth";
import { checkFreeTier, FREE, __resetRateLimitForTest } from "./ratelimit";

describe("signed session", () => {
  test("round-trips a signed email from a cookie header", async () => {
    const token = await signSession("eri@x");
    const header = sessionCookie(token).split(";")[0]!; // "hpx_sess=<token>"
    expect(await readSessionEmail(header)).toBe("eri@x");
  });

  test("rejects a tampered token", async () => {
    const token = await signSession("eri@x");
    const tampered = `${COOKIE_NAME}=${token.slice(0, -2)}xx`;
    expect(await readSessionEmail(tampered)).toBeNull();
  });

  test("no cookie → null", async () => {
    expect(await readSessionEmail(undefined)).toBeNull();
    expect(await readSessionEmail("other=1")).toBeNull();
  });
});

describe("free tier", () => {
  beforeEach(() => __resetRateLimitForTest());

  test("allows up to the lifetime cap then blocks", () => {
    let last = checkFreeTier("id-a", "1.1.1.1");
    for (let i = 1; i < FREE.lifetime; i++) last = checkFreeTier("id-a", "1.1.1.1");
    expect(last.allowed).toBe(true);
    expect(last.remaining).toBe(0);
    const over = checkFreeTier("id-a", "1.1.1.1");
    expect(over.allowed).toBe(false);
    expect(over.reason).toContain("free trial");
  });

  test("daily IP cap blocks distinct identities sharing an IP", () => {
    for (let i = 0; i < FREE.daily; i++) checkFreeTier(`id-${i}`, "9.9.9.9");
    const over = checkFreeTier("id-new", "9.9.9.9");
    expect(over.allowed).toBe(false);
    expect(over.reason).toContain("daily");
  });
});
