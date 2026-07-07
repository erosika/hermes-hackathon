import { useState } from "react";
import { useAuth } from "./AuthProvider";

type Mode = "signin" | "signup" | "forgot" | "reset";

const COPY: Record<Mode, { head: string; body: string; cta: string }> = {
  signin: { head: "sign in", body: "Email + password.", cta: "sign in" },
  signup: { head: "create account", body: "Pick an email + password (8+ chars) — you're in immediately.", cta: "create account" },
  forgot: { head: "reset password", body: "Enter your email — we'll send a reset link.", cta: "send reset link" },
  reset: { head: "set new password", body: "Pick a new password (8+ chars).", cta: "set password" },
};

export function SignInModal({ onClose, initialMode = "signin" }: { onClose: () => void; initialMode?: Mode }) {
  const { signIn, signUp, resetPassword, updatePassword } = useAuth();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [err, setErr] = useState("");

  const needsEmail = mode !== "reset";
  const needsPw = mode !== "forgot";
  const needsConfirm = mode === "signup" || mode === "reset";
  const ready = (!needsEmail || email.trim()) && (!needsPw || password) && (!needsConfirm || confirm);

  const fail = (m: string) => { setErr(m); setState("error"); };

  const submit = async () => {
    if (!ready || state === "busy") return;
    if (needsPw && password.length < 8) return fail("password must be 8+ chars");
    if (needsConfirm && password !== confirm) return fail("passwords don't match");
    setState("busy");
    try {
      if (mode === "signin") { await signIn(email.trim(), password); onClose(); }
      else if (mode === "signup") { await signUp(email.trim(), password); onClose(); }
      else if (mode === "forgot") { await resetPassword(email.trim()); setState("sent"); }
      else { await updatePassword(password); onClose(); }
    } catch (ex) {
      fail(ex instanceof Error ? ex.message.toLowerCase() : "something broke — try again");
    }
  };

  const swap = (m: Mode) => { setMode(m); setState("idle"); setConfirm(""); };
  const onField = (set: (v: string) => void) => (v: string) => { set(v); if (state === "error") setState("idle"); };

  return (
    <div className="kbd-backdrop" onClick={onClose}>
      <div className="signin" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <span className="label">{COPY[mode].head}</span>
          <button className="win-btn close" onClick={onClose} title="close">×</button>
        </div>
        <div className="signin-body">
          {state === "sent" ? (
            <p className="signin-sent">Check your email for the reset link ↗</p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); void submit(); }}>
              <p className="signin-copy">{COPY[mode].body}</p>
              {needsEmail && (
                <input
                  className={`pick signin-in ${state === "error" ? "bad" : ""}`}
                  value={email}
                  onChange={(e) => onField(setEmail)(e.target.value)}
                  placeholder="you@example.com"
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  autoFocus
                />
              )}
              {needsPw && (
                <input
                  className={`pick signin-in ${state === "error" ? "bad" : ""}`}
                  value={password}
                  onChange={(e) => onField(setPassword)(e.target.value)}
                  placeholder={mode === "reset" ? "new password" : "password"}
                  type="password"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  autoFocus={mode === "reset"}
                />
              )}
              {needsConfirm && (
                <input
                  className={`pick signin-in ${state === "error" ? "bad" : ""}`}
                  value={confirm}
                  onChange={(e) => onField(setConfirm)(e.target.value)}
                  placeholder="confirm password"
                  type="password"
                  autoComplete="new-password"
                />
              )}
              {state === "error" && <p className="signin-err label">{err || "couldn't sign in — try again"}</p>}
              <button className="sub-btn signin-go" type="submit" disabled={state === "busy" || !ready}>
                {state === "busy" ? "…" : COPY[mode].cta}
              </button>
              {mode === "signin" && (
                <>
                  <button className="signin-swap label" type="button" onClick={() => swap("signup")}>no account? create one</button>
                  <button className="signin-swap label" type="button" onClick={() => swap("forgot")}>forgot password?</button>
                </>
              )}
              {(mode === "signup" || mode === "forgot") && (
                <button className="signin-swap label" type="button" onClick={() => swap("signin")}>have an account? sign in</button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
