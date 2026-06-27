import { expect, test, describe, beforeEach } from "bun:test";
import { FLOAT } from "@hermetika/shared";
import {
  recordIncome,
  meter,
  ledger,
  floatUsd,
  incomeUsd,
  spendUsd,
  netUsd,
  stewardDecision,
  stewardStatus,
  stewardTick,
  __resetLedgerForTest,
} from "./ledger";
import type { Backend } from "./backends";

const owned: Backend = { baseUrl: "http://spark.test/v1", runtime: "vllm", paid: false };
const paid: Backend = { baseUrl: "http://brev.test/v1", runtime: "vllm", paid: true };

beforeEach(() => __resetLedgerForTest());

describe("cash ledger (the P&L) vs credit wallet (float)", () => {
  test("customer revenue is cash-in and does not touch the credit wallet", () => {
    expect(floatUsd()).toBe(24);
    recordIncome(30, "stripe", "sub");
    expect(incomeUsd()).toBe(30);
    expect(floatUsd()).toBe(24); // revenue funds the business, not the credit float directly
  });

  test("net = income − spend", () => {
    recordIncome(48, "stripe", "subs");
    expect(netUsd()).toBe(48);
    expect(spendUsd()).toBe(0);
  });
});

describe("metering — owned floor, paid ceiling (burns credit, no cash row)", () => {
  test("owned compute is free → no burn, float unchanged", () => {
    meter("spark", owned, 100_000, "oracle-07");
    expect(ledger()).toHaveLength(0);
    expect(floatUsd()).toBe(24);
  });

  test("paid inference burns prepaid credit, not cash", () => {
    meter("brev", paid, 1000, "unbound-13b"); // 1k tok · vllm $0.0008/1k
    expect(ledger()).toHaveLength(0); // prepaid → no new cash row
    // float reports to 2 decimals: a single sub-cent inference rounds away.
    // demo-tuning note — to move the needle on camera the paid inferences must be high-token.
    expect(floatUsd()).toBe(24);
  });

  test("enough paid volume actually moves the float", () => {
    meter("brev", paid, 5_000_000, "unbound-13b"); // 5M tok · $0.0008/1k = $4
    expect(floatUsd()).toBe(20);
  });
});

describe("steward decision", () => {
  test("no top-up while float is above the low-water mark", () => {
    expect(stewardDecision().topUp).toBe(false);
  });

  test("top-up flagged once float dips below low-water", () => {
    __resetLedgerForTest(FLOAT.lowWater - 1);
    const d = stewardDecision();
    expect(d.topUp).toBe(true);
    expect(d.amount).toBe(FLOAT.topUp);
  });
});

// realistic clock — real ticks use Date.now(), so lastTopUpAt(=0) is always far past.
const T = 1_700_000_000_000;

describe("survival loop — the closed tick", () => {
  test("does nothing when float is healthy", async () => {
    expect(await stewardTick(T)).toBe(false);
    expect(ledger()).toHaveLength(0);
  });

  test("low float → autonomous top-up: real USD spend + credit bought lifts the float", async () => {
    __resetLedgerForTest(10);
    expect(await stewardTick(T)).toBe(true);
    expect(floatUsd()).toBe(10 + FLOAT.topUp); // credit wallet refilled
    const spend = ledger().filter((e) => e.kind === "spend");
    expect(spend).toHaveLength(1); // real USD out is booked as cash spend
    expect(spend[0]!.ref).toBe("demo"); // default rail; STEWARD_RAIL=stripe swaps this
    expect(spendUsd()).toBe(FLOAT.topUp);
  });

  test("cooldown gates one dip to one charge", async () => {
    __resetLedgerForTest(-100); // stays below low-water even after a top-up
    expect(await stewardTick(T)).toBe(true);
    expect(await stewardTick(T + 1_000)).toBe(false); // inside cooldown window
    expect(await stewardTick(T + FLOAT.cooldownMs)).toBe(true); // cooldown elapsed
    expect(ledger().filter((e) => e.kind === "spend")).toHaveLength(2);
  });

  test("net goes negative when top-ups outrun revenue", async () => {
    __resetLedgerForTest(-100);
    recordIncome(10, "stripe", "sub"); // only $10 revenue
    await stewardTick(T); // $25 top-up spend
    expect(netUsd()).toBe(-15); // 10 income − 25 spend
  });

  test("stewardStatus reports P&L and the last autonomous action", async () => {
    __resetLedgerForTest(5);
    recordIncome(40, "stripe", "sub");
    expect(stewardStatus().lastAction).toBeNull();
    await stewardTick(T);
    const s = stewardStatus();
    expect(s.income).toBe(40);
    expect(s.spend).toBe(FLOAT.topUp);
    expect(s.net).toBe(40 - FLOAT.topUp);
    expect(s.lastAction).not.toBeNull();
    expect(s.lastAction!.amount).toBe(FLOAT.topUp);
    expect(s.lastAction!.floatBefore).toBe(5);
    expect(s.lastAction!.floatAfter).toBe(5 + FLOAT.topUp);
  });
});
