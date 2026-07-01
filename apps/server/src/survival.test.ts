import { expect, test, describe, beforeEach } from "bun:test";
import { FLOAT } from "@hermetika/shared";
import {
  recordIncome,
  incomeUsd,
  spendUsd,
  netUsd,
  floatUsd,
  ledger,
  stewardTick,
  __resetLedgerForTest,
} from "./ledger";
import {
  listSubscriptions,
  isSubscribed,
  __resetSubsForTest,
} from "./subscriptions";
import { verifyAndParse, handleStripeEvent, type StripeEventLike } from "./webhooks";
import { nudge } from "./nudge";
import { MODELS } from "./seed";

// end-to-end "velvet-circuit" — income lane (Stripe → ledger + subs), admission
// gate (nudge → MODELS), and the steward survival loop, wired as one closed loop.

// MODELS has no reset seam (module-level seed the gateway mutates), so admission
// cases use slugs guaranteed absent from the seed and assert on the length delta.
const FRESH_A = "velvet-alpha";
const FRESH_B = "velvet-beta";

// remove any rows a prior run's admits left behind so the length delta is exact.
function purgeTestAdmits(): void {
  for (const slug of [FRESH_A, FRESH_B]) {
    const i = MODELS.findIndex((m) => m.slug === slug);
    if (i >= 0) MODELS.splice(i, 1);
  }
}

// a checkout.session.completed body as Stripe sends it — cents, with metadata.slug
// so the handler both books income and activates a subscription.
function checkoutBody(cents: number, slug: string, email = "buyer@test"): string {
  return JSON.stringify({
    type: "checkout.session.completed",
    data: { object: { amount_total: cents, customer_email: email, metadata: { slug } } },
  });
}

beforeEach(() => {
  __resetLedgerForTest();
  __resetSubsForTest();
  purgeTestAdmits();
});

// realistic clock — real ticks use Date.now(), so lastTopUpAt(=0) is always far past.
const T = 1_700_000_000_000;

describe("income lane — Stripe webhook → cash-in + subscription", () => {
  test("checkout.session.completed books income and activates a subscription", async () => {
    expect(incomeUsd()).toBe(0);
    expect(listSubscriptions()).toHaveLength(0);

    const evt = verifyAndParse(checkoutBody(3000, "oracle-07")); // demo mode, no secret → JSON.parse
    const res = await handleStripeEvent(evt);

    expect(res.handled).toBe(true);
    expect(incomeUsd()).toBe(30); // 3000 cents → $30
    expect(isSubscribed("oracle-07")).toBe(true);
    expect(listSubscriptions()).toHaveLength(1);
  });

  test("invoice.paid books income too (amount_paid in cents)", async () => {
    const evt: StripeEventLike = {
      type: "invoice.paid",
      data: { object: { amount_paid: 1800, metadata: { slug: "scarab-visual" } } },
    };
    const res = await handleStripeEvent(evt);

    expect(res.handled).toBe(true);
    expect(incomeUsd()).toBe(18); // 1800 cents → $18
    expect(isSubscribed("scarab-visual")).toBe(true);
  });

  test("an unrelated event type is ignored and books nothing", async () => {
    const res = await handleStripeEvent({ type: "customer.updated", data: { object: {} } });

    expect(res.handled).toBe(false);
    expect(incomeUsd()).toBe(0);
    expect(spendUsd()).toBe(0);
    expect(listSubscriptions()).toHaveLength(0);
  });
});

describe("admission gate — nudge admits the licensed, rejects the rest", () => {
  test("only the admissible-license slug enters the pantheon", () => {
    const before = MODELS.length;
    const results = nudge(`${FRESH_A}:apache-2.0, ${FRESH_B}:proprietary`);

    expect(results).toHaveLength(2);
    expect(results[0]!.ok).toBe(true); // apache-2.0 is on the allowlist
    expect(results[1]!.ok).toBe(false); // proprietary is not
    expect(results[1]!.reason).toContain("not admissible");
    expect(MODELS.length).toBe(before + 1); // exactly one admitted
    expect(MODELS.some((m) => m.slug === FRESH_A)).toBe(true);
    expect(MODELS.some((m) => m.slug === FRESH_B)).toBe(false);
  });

  test("a slug already in the pantheon is rejected as a duplicate", () => {
    nudge(`${FRESH_A}:apache-2.0`); // first admit lands it
    const before = MODELS.length;
    const results = nudge(`${FRESH_A}:apache-2.0`); // second is a dup

    expect(results[0]!.ok).toBe(false);
    expect(results[0]!.reason).toContain("already in pantheon");
    expect(MODELS.length).toBe(before); // no growth on the dup
  });
});

describe("steward survival loop — autonomous top-up under low water", () => {
  test("low float fires a top-up: float rises, a spend row is booked", async () => {
    __resetLedgerForTest(FLOAT.lowWater - 5); // seed below low-water
    expect(floatUsd()).toBe(FLOAT.lowWater - 5);

    const fired = await stewardTick(T);
    expect(fired).toBe(true);
    expect(floatUsd()).toBe(FLOAT.lowWater - 5 + FLOAT.topUp); // credit wallet refilled
    const spend = ledger().filter((e) => e.kind === "spend");
    expect(spend).toHaveLength(1); // real USD out booked as a cash spend row
    expect(spendUsd()).toBe(FLOAT.topUp);
  });

  test("a second immediate tick is cooldown-gated", async () => {
    __resetLedgerForTest(-100); // stays below low-water even after a top-up
    expect(await stewardTick(T)).toBe(true);
    expect(await stewardTick(T + 1_000)).toBe(false); // inside the cooldown window
    expect(ledger().filter((e) => e.kind === "spend")).toHaveLength(1); // only one charge
  });
});

describe("full circuit — net = income − spend stays coherent", () => {
  test("income event then a steward top-up leaves a coherent P&L", async () => {
    __resetLedgerForTest(FLOAT.lowWater - 1); // low enough to fire the steward

    const evt = verifyAndParse(checkoutBody(4800, "hermes-4")); // $48 revenue in
    await handleStripeEvent(evt);
    await stewardTick(T); // one autonomous top-up out

    expect(incomeUsd()).toBe(48);
    expect(spendUsd()).toBe(FLOAT.topUp);
    expect(netUsd()).toBe(48 - FLOAT.topUp); // the money-shot reconciles
    expect(isSubscribed("hermes-4")).toBe(true); // customer side intact through the loop
  });
});
