import { expect, test, describe, beforeEach } from "bun:test";
import { recordIncome, incomeUsd, __resetLedgerForTest } from "./ledger";
import { activateSubscription, mrrUsd, activeCount, isSubscribed, cancelSubscription, __resetSubsForTest } from "./subscriptions";
import { handleStripeEvent, verifyAndParse, type StripeEventLike } from "./webhooks";
import { subscribeUrl, PLAN } from "./billing";

beforeEach(() => {
  __resetLedgerForTest();
  __resetSubsForTest();
});

describe("income log", () => {
  test("records and sums income", () => {
    recordIncome(9, "stripe", "a");
    recordIncome(9, "stripe", "b");
    expect(incomeUsd()).toBe(18);
  });
});

describe("subscriptions + MRR", () => {
  test("active subs drive MRR and count", () => {
    activateSubscription(PLAN.slug, "ada@x", 9);
    activateSubscription(PLAN.slug, "lin@x", 9);
    expect(activeCount()).toBe(2);
    expect(mrrUsd()).toBe(18);
    expect(isSubscribed("ada@x")).toBe(true);
    expect(isSubscribed("nobody@x")).toBe(false);
  });

  test("cancel drops MRR", () => {
    const s = activateSubscription(PLAN.slug, "ada@x", 9);
    expect(cancelSubscription(s.id)).toBe(true);
    expect(activeCount()).toBe(0);
    expect(mrrUsd()).toBe(0);
    expect(isSubscribed("ada@x")).toBe(false);
  });
});

describe("stripe webhook → revenue", () => {
  test("checkout.session.completed books income + activates a sub", async () => {
    const evt: StripeEventLike = {
      type: "checkout.session.completed",
      data: { object: { amount_total: 900, customer_email: "buyer@x" } },
    };
    const r = await handleStripeEvent(evt);
    expect(r.handled).toBe(true);
    expect(incomeUsd()).toBe(9);
    expect(isSubscribed("buyer@x")).toBe(true);
  });

  test("unrelated events are ignored, book nothing", async () => {
    const r = await handleStripeEvent({ type: "customer.updated", data: { object: {} } });
    expect(r.handled).toBe(false);
    expect(incomeUsd()).toBe(0);
    expect(activeCount()).toBe(0);
  });
});

describe("stripe webhook verification", () => {
  test("live mode rejects unsigned bodies", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_x";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_x";
    await expect(verifyAndParse('{"type":"checkout.session.completed"}', undefined)).rejects.toThrow("missing stripe-signature");
  });

  test("demo mode parses unsigned json", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const evt = await verifyAndParse('{"type":"invoice.paid"}', undefined);
    expect(evt.type).toBe("invoice.paid");
  });
});

describe("subscribe link", () => {
  test("demo mode returns a local stub url", async () => {
    delete process.env.STRIPE_SECRET_KEY; // isolate from a real key in .env
    const link = await subscribeUrl();
    expect(link.live).toBe(false);
    expect(link.url).toContain("/checkout/demo");
    expect(link.plan).toBe(PLAN.slug);
  });
});
