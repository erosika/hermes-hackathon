import { useState } from "react";
import { useAuth } from "./AuthProvider";
import { getPortal, getSubscribe } from "./api";

export function AccountMenu({ onClose }: { onClose: () => void }) {
  const { email, subscribed, signOut } = useAuth();
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // manage/cancel opens the Stripe Billing Portal; if there's no customer yet, offer checkout.
  const manage = async () => {
    setBusy(true);
    setNote(null);
    try {
      const { url } = await getPortal();
      window.open(url, "_blank", "noopener");
    } catch {
      try {
        const link = await getSubscribe();
        window.open(link.url, "_blank", "noopener");
      } catch {
        setNote("billing unavailable — try again");
      }
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
            <span className={`badge ${subscribed ? "pro" : "free"}`}>{subscribed ? "pantheon pro · unlimited" : "free tier"}</span>
          </div>
          {note && <div className="label" style={{ color: "var(--accent-rust)" }}>{note}</div>}
          <div className="account-actions">
            <button className="sub-btn" onClick={() => void manage()} disabled={busy}>
              {busy ? "…" : subscribed ? "manage / cancel billing" : "subscribe · $2/mo"}
            </button>
            <button className="seg-btn" onClick={() => { void signOut(); onClose(); }}>sign out</button>
          </div>
          <div className="label account-hint">manage / cancel opens the stripe billing portal</div>
        </div>
      </div>
    </div>
  );
}
