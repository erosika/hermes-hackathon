import { useEffect, useState } from "react";
import { getSubscribe, subscribeDemo, type SubscribeLink } from "./api";
import { useAuth } from "./AuthProvider";
import { CreditsWidget } from "./CreditsWidget";

export function StatusBar() {
  const { email, subscribed, refresh } = useAuth();
  const [link, setLink] = useState<SubscribeLink | null>(null);

  // subscribe url is session-aware (carries the signed-in email), so refetch when auth changes.
  useEffect(() => { getSubscribe().then(setLink).catch(() => {}); }, [email]);

  const price = link ? `$${link.priceUsd}/mo` : "";

  const onSubscribe = async () => {
    if (!link) return;
    if (!link.live) {
      try { await subscribeDemo(); } catch { /* gateway offline */ }
      await refresh();
      return;
    }
    window.open(link.url, "_blank", "noopener");
    setTimeout(() => void refresh(), 2500);
  };

  return (
    <footer className="status-bar">
      <span className="label">hermetika · operated by hermes</span>
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
      <CreditsWidget />
    </footer>
  );
}
