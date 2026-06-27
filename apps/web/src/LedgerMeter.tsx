import { useEffect, useState } from "react";
import { getLedger, getSteward, type LedgerView, type StewardView } from "./api";
import { FLOAT } from "@hermetika/shared";

// the demo's visual hook — the survival loop as a hardware meter.
// float reads green above low-water, amber when the steward is about to fire.
// motion is calm: a 4s poll, no flashing, no strobe (epilepsy constraint).

const POLL_MS = 4000;

function usd(n: number): string {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

export function LedgerMeter() {
  const [ledger, setLedger] = useState<LedgerView | null>(null);
  const [steward, setSteward] = useState<StewardView | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [l, s] = await Promise.all([getLedger(), getSteward()]);
        if (!alive) return;
        setLedger(l);
        setSteward(s);
        setOffline(false);
      } catch {
        if (alive) setOffline(true);
      }
    };
    void tick();
    const h = setInterval(tick, POLL_MS);
    return () => {
      alive = false;
      clearInterval(h);
    };
  }, []);

  const float = ledger?.float ?? 0;
  const income = ledger?.income ?? 0;
  const spend = ledger?.spend ?? 0;
  const net = ledger?.net ?? 0;
  const low = float < FLOAT.lowWater;
  const positive = net >= 0;
  const last = steward?.lastAction ?? null;
  const recent = (ledger?.entries ?? []).slice(-5).reverse();

  return (
    <section className="meter">
      <div className="meter-head">
        <span className="label">survival ledger · hermes.steward</span>
        <span className="label">{offline ? "offline" : low ? "float low" : positive ? "net positive" : "net negative"}</span>
      </div>

      <div className="meter-row">
        <div className={`readout ${low ? "warn" : "ok"}`}>
          <span className="label">credit float</span>
          <span className="digits">{usd(float)}</span>
          <span className="label">low-water {usd(FLOAT.lowWater)}</span>
        </div>
        <div className={`readout ${positive ? "ok" : "warn"}`}>
          <span className="label">net p&amp;l</span>
          <span className="digits">{usd(net)}</span>
          <span className="label">revenue − vendor</span>
        </div>
        <div className="readout">
          <span className="label">revenue in</span>
          <span className="digits sm">{usd(income)}</span>
        </div>
        <div className="readout">
          <span className="label">vendor out</span>
          <span className="digits sm">{usd(spend)}</span>
        </div>
      </div>

      <div className="label steward-line">
        {last
          ? `last top-up · ${usd(last.amount)} · ${usd(last.floatBefore)} → ${usd(last.floatAfter)}`
          : "steward idle · no autonomous top-up yet"}
      </div>

      <div className="tape">
        {recent.length === 0 && <span className="label">no ledger activity</span>}
        {recent.map((e) => (
          <div className="tape-row" key={e.id}>
            <span className={`tag ${e.kind === "income" ? "in" : "out"}`}>{e.kind}</span>
            <span className="tape-amt">{e.kind === "income" ? "+" : "-"}{usd(e.amountUsd)}</span>
            <span className="tape-note">{e.note}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
