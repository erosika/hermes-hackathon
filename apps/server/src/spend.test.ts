import { expect, test, describe, beforeEach, afterEach } from "bun:test";
import { guardedSpend, __resetSpendForTest } from "./spend";
import { cardSpendingControls } from "./issuing";

const KEY = (n: number) => ({ idempotencyKey: `k${n}` });

// restore env between cases so policy() reads clean defaults.
const ENV_KEYS = ["STEWARD_RAIL", "STEWARD_HALT", "STEWARD_MAX_TX_USD", "STEWARD_MAX_DAILY_USD"];
let saved: Record<string, string | undefined>;
beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  ENV_KEYS.forEach((k) => delete process.env[k]);
  __resetSpendForTest();
});
afterEach(() => {
  for (const [k, v] of Object.entries(saved)) v === undefined ? delete process.env[k] : (process.env[k] = v);
});

describe("spend guard — caps and kill-switch", () => {
  test("demo rail books the spend by default", async () => {
    const r = await guardedSpend(25, KEY(1));
    expect(r.ok).toBe(true);
    expect(r.ref).toBe("demo");
  });

  test("stripe issuing rail (dry-run) routes through the guard", async () => {
    process.env.STEWARD_RAIL = "stripe";
    const r = await guardedSpend(25, KEY(1));
    expect(r.ok).toBe(true);
    expect(r.ref).toBe("stripe-issuing");
    expect(r.txHash).toBe("dry-run"); // no real Stripe call unless STEWARD_ISSUING_ARMED=1
  });

  test("kill-switch halts all spend", async () => {
    process.env.STEWARD_HALT = "1";
    const r = await guardedSpend(1, KEY(1));
    expect(r.ok).toBe(false);
    expect(r.ref).toBe("halt");
  });

  test("per-tx cap is enforced", async () => {
    process.env.STEWARD_MAX_TX_USD = "20";
    const r = await guardedSpend(25, KEY(1));
    expect(r.ok).toBe(false);
    expect(r.error).toContain("per-tx cap");
  });

  test("non-positive amounts are refused", async () => {
    expect((await guardedSpend(0, KEY(1))).ok).toBe(false);
    expect((await guardedSpend(-5, KEY(2))).ok).toBe(false);
  });

  test("daily cap stops the bleed across many ticks", async () => {
    process.env.STEWARD_MAX_DAILY_USD = "60";
    expect((await guardedSpend(25, KEY(1))).ok).toBe(true);
    expect((await guardedSpend(25, KEY(2))).ok).toBe(true); // 50 total
    const third = await guardedSpend(25, KEY(3)); // would be 75 > 60
    expect(third.ok).toBe(false);
    expect(third.error).toContain("daily cap");
  });

  test("idempotency suppresses a duplicate spend (one dip = one pay)", async () => {
    expect((await guardedSpend(25, KEY(1))).ok).toBe(true);
    const dup = await guardedSpend(25, KEY(1)); // same key
    expect(dup.ok).toBe(false);
    expect(dup.ref).toBe("idempotent");
  });
});

// the Stripe Issuing card's controls must mirror the guard caps (defense in depth).
describe("issuing spend controls mirror the guard", () => {
  test("caps map to per-authorization + daily limits in cents", () => {
    const c = cardSpendingControls({ maxTxUsd: 50, maxDailyUsd: 200, categories: [] });
    expect(c.spending_limits).toEqual([
      { amount: 5000, interval: "per_authorization" },
      { amount: 20000, interval: "daily" },
    ]);
    expect("allowed_categories" in c).toBe(false); // no restriction when empty
  });

  test("category allowlist is applied when set", () => {
    const c = cardSpendingControls({ maxTxUsd: 25, maxDailyUsd: 100, categories: ["computer_software_stores"] });
    expect((c as { allowed_categories?: string[] }).allowed_categories).toEqual(["computer_software_stores"]);
  });
});
