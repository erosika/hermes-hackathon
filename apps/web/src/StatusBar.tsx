import { useEffect, useState } from "react";
import { getLedger, getSteward, type LedgerView, type StewardView } from "./api";

export function StatusBar() {
  const [ledger, setLedger] = useState<LedgerView | null>(null);
  const [steward, setSteward] = useState<StewardView | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const [l, s] = await Promise.all([getLedger(), getSteward()]);
        if (alive) { setLedger(l); setSteward(s); }
      } catch { /* gateway offline */ }
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const usd = (n?: number) => `$${(n ?? 0).toFixed(2)}`;
  const stewardMsg = steward?.lastAction
    ? `last top-up ${usd(steward.lastAction.amount)}`
    : steward?.topUp
      ? "float low · top-up pending"
      : "steward idle";

  return (
    <footer className="status-bar">
      <span className="label">survival ledger · hermes.steward</span>
      <div className="stat"><span className="label">float</span><b>{usd(ledger?.float)}</b></div>
      <div className="stat ok"><span className="label">net</span><b>{usd(ledger?.net)}</b></div>
      <div className="stat"><span className="label">rev in</span><b>{usd(ledger?.income)}</b></div>
      <div className="stat"><span className="label">vendor out</span><b>{usd(ledger?.spend)}</b></div>
      <span className="spacer" />
      <span className="label">{stewardMsg}</span>
    </footer>
  );
}
