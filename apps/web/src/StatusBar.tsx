import { useEffect, useState } from "react";
import { getRevenue, getSubscribe, type RevenueView, type SubscribeLink } from "./api";

export function StatusBar() {
  const [rev, setRev] = useState<RevenueView | null>(null);
  const [link, setLink] = useState<SubscribeLink | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const r = await getRevenue();
        if (alive) setRev(r);
      } catch { /* gateway offline */ }
    };
    void tick();
    getSubscribe().then((l) => alive && setLink(l)).catch(() => {});
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  const usd = (n?: number) => `$${(n ?? 0).toFixed(2)}`;
  const price = link ? `$${link.priceUsd}/mo` : "";

  return (
    <footer className="status-bar">
      <span className="label">pantheon pro · operated by hermes</span>
      <div className="stat ok"><span className="label">mrr</span><b>{usd(rev?.mrr)}</b></div>
      <div className="stat"><span className="label">subscribers</span><b>{rev?.active ?? 0}</b></div>
      <div className="stat"><span className="label">booked</span><b>{usd(rev?.incomeTotal)}</b></div>
      <span className="spacer" />
      {link && (
        <button className="sub-btn" onClick={() => window.open(link.url, "_blank", "noopener")}>
          subscribe · {price}{link.live ? "" : " · demo"}
        </button>
      )}
    </footer>
  );
}
