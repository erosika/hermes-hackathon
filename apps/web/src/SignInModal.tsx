import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function SignInModal({ onClose }: { onClose: () => void }) {
  const { signIn } = useAuth();
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");

  const submit = async () => {
    const v = draft.trim();
    if (!v || state === "busy") return;
    setState("busy");
    try {
      await signIn(v);
      setState("sent");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="kbd-backdrop" onClick={onClose}>
      <div className="signin" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <span className="label">sign in</span>
          <button className="win-btn close" onClick={onClose} title="close">×</button>
        </div>
        <div className="signin-body">
          {state === "sent" ? (
            <p className="signin-sent">Check your email for the magic link ↗</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <p className="signin-copy">Enter your email — we'll send a one-time magic link. No password.</p>
              <input
                className={`pick signin-in ${state === "error" ? "bad" : ""}`}
                value={draft}
                onChange={(e) => { setDraft(e.target.value); if (state === "error") setState("idle"); }}
                placeholder="you@example.com"
                type="text"
                inputMode="email"
                autoComplete="email"
                autoFocus
              />
              {state === "error" && <p className="signin-err label">couldn't send — try again</p>}
              <button className="sub-btn signin-go" type="submit" disabled={state === "busy" || !draft.trim()}>
                {state === "busy" ? "sending…" : "send magic link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
