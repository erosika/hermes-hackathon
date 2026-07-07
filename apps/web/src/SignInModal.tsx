import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function SignInModal({ onClose }: { onClose: () => void }) {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "error">("idle");
  const [err, setErr] = useState("");

  const submit = async () => {
    const e = email.trim();
    if (!e || !password || state === "busy") return;
    setState("busy");
    try {
      await (mode === "signin" ? signIn(e, password) : signUp(e, password));
      onClose(); // session lands via onAuthStateChange
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message.toLowerCase() : "something broke — try again");
      setState("error");
    }
  };

  const swap = () => {
    setMode((m) => (m === "signin" ? "signup" : "signin"));
    setState("idle");
  };

  return (
    <div className="kbd-backdrop" onClick={onClose}>
      <div className="signin" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <span className="label">{mode === "signin" ? "sign in" : "create account"}</span>
          <button className="win-btn close" onClick={onClose} title="close">×</button>
        </div>
        <div className="signin-body">
          <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
            <p className="signin-copy">
              {mode === "signin" ? "Email + password." : "Pick an email + password (6+ chars) — you're in immediately."}
            </p>
            <input
              className={`pick signin-in ${state === "error" ? "bad" : ""}`}
              value={email}
              onChange={(e) => { setEmail(e.target.value); if (state === "error") setState("idle"); }}
              placeholder="you@example.com"
              type="text"
              inputMode="email"
              autoComplete="email"
              autoFocus
            />
            <input
              className={`pick signin-in ${state === "error" ? "bad" : ""}`}
              value={password}
              onChange={(e) => { setPassword(e.target.value); if (state === "error") setState("idle"); }}
              placeholder="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />
            {state === "error" && <p className="signin-err label">{err || "couldn't sign in — try again"}</p>}
            <button className="sub-btn signin-go" type="submit" disabled={state === "busy" || !email.trim() || !password}>
              {state === "busy" ? "…" : mode === "signin" ? "sign in" : "create account"}
            </button>
            <button className="signin-swap label" type="button" onClick={swap}>
              {mode === "signin" ? "no account? create one" : "have an account? sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
