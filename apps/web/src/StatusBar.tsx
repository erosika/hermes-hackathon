import { useEffect, useState } from "react";
import { getRevenue, getSubscribe, type RevenueView, type SubscribeLink } from "./api";
import { useAuth } from "./AuthProvider";

export function StatusBar() {
  const { email, subscribed, refresh } = useAuth();
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
    const id = setInterval(tick, 5000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  // subscribe url is session-aware (carries the signed-in email), so refetch when auth changes.
  useEffect(() => { getSubscribe().then(setLink).catch(() => {}); }, [email]);

  const usd = (n?: number) => `$${(n ?? 0).toFixed(2)}`;
  const price = link ? `$${link.priceUsd}/mo` : "";

  const onSubscribe = () => {
    if (!link) return;
    window.open(link.url, "_blank", "noopener");
    // demo checkout completes in the new tab; reflect the new sub shortly after.
    setTimeout(() => void refresh(), 2500);
  };

  return (
    <footer className="status-bar">
      <span className="label">hermetika · operated by hermes</span>
      <div className="stat ok"><span className="label">mrr</span><b>{usd(rev?.mrr)}</b></div>
      <div className="stat"><span className="label">subscribers</span><b>{rev?.active ?? 0}</b></div>
      <div className="stat"><span className="label">booked</span><b>{usd(rev?.incomeTotal)}</b></div>
      <span className="spacer" />
      {subscribed ? (
        <span className="badge pro">subscribed · unlimited</span>
      ) : !email ? (
        <span className="label">sign in to subscribe</span>
      ) : (
        <button className="sub-btn" onClick={onSubscribe}>
          subscribe · {price}{link && !link.live ? " · demo" : ""}
        </button>
      )}
    </footer>
  );
}
