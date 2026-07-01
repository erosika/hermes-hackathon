import { useState } from "react";
import { PRICING } from "@hermetika/shared";
import { useAuth } from "./AuthProvider";
import { getPortal, getSubscribe, subscribeDemo } from "./api";

export function AccountMenu({ onClose }: { onClose: () => void }) {
  const { email, subscribed, signOut, refresh } = useAuth();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // subscribe — demo mode grants server-side; live opens Stripe checkout.
  const subscribe = async () => {
    setBusy(true);
    setNote(null);
    try {
      const link = await getSubscribe();
      if (!link.live) { await subscribeDemo(); await refresh(); }
      else window.open(link.url, "_blank", "noopener");
    } catch {
      setNote("billing unavailable — try again");
    } finally {
      setBusy(false);
    }
  };

  // manage/cancel opens the Stripe Billing Portal (live only).
  const manage = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { url } = await getPortal();
      window.open(url, "_blank", "noopener");
    } catch {
      setNote("no billing account yet");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="kbd-backdrop" onClick={onClose}>
      <div className="account" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <span className="label">account</span>
          <button className="win-btn close" onClick={onClose} title="close">×</button>
        </div>
        <div className="account-body">
          <div className="account-row">
            <span className="label">email</span>
            <span className="account-email">{email}</span>
          </div>
          <div className="account-row">
            <span className="label">plan</span>
            <span className={`badge ${subscribed ? "pro" : "free"}`}>{subscribed ? "hermetika pro · unlimited" : "free tier"}</span>
          </div>
          {note && <div className="label" style={{ color: "var(--accent-rust)" }}>{note}</div>}
          <div className="account-actions">
            <button className="sub-btn" onClick={() => void (subscribed ? manage() : subscribe())} disabled={busy}>
              {busy ? "…" : subscribed ? "manage / cancel billing" : `subscribe · $${PRICING.defaultMonthlyUsd}/mo`}
            </button>
            <button className="seg-btn" onClick={() => { void signOut(); onClose(); }}>sign out</button>
          </div>
          <div className="label account-hint">manage / cancel opens the stripe billing portal</div>
        </div>
      </div>
    </div>
  );
}
