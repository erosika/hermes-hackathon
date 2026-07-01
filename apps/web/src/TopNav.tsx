import { useState } from "react";
import { Reorder } from "framer-motion";
import { THEMES, FONTS, useTheme, type Theme, type Font } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { AccountMenu } from "./AccountMenu";
import type { LayoutMode } from "./lib/TilingLayoutManager";
import type { WinState } from "./Desktop";

function AuthCluster() {
  const { email, subscribed, configured, signIn } = useAuth();
  const [draft, setDraft] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "sent" | "error">("idle");
  const [account, setAccount] = useState(false);

  if (!configured) return <span className="label" title="set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY">auth not configured</span>;

  if (email) {
    return (
      <>
        <button className="auth acct-btn" onClick={() => setAccount(true)} title="account">
          <span className={`badge ${subscribed ? "pro" : "free"}`}>{subscribed ? "pro" : "free"}</span>
          <span className="label auth-email">{email}</span>
        </button>
        {account && <AccountMenu onClose={() => setAccount(false)} />}
      </>
    );
  }

  if (state === "sent") return <span className="label">check your email for the link ↗</span>;

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
    <form className="auth" noValidate onSubmit={(e) => { e.preventDefault(); void submit(); }}>
      <input
        className={`pick auth-in ${state === "error" ? "bad" : ""}`}
        value={draft}
        onChange={(e) => { setDraft(e.target.value); if (state === "error") setState("idle"); }}
        placeholder="email · magic link"
        type="text"
        inputMode="email"
        autoComplete="email"
      />
      <button className="seg-btn" type="submit" disabled={state === "busy" || !draft.trim()}>
        {state === "busy" ? "…" : "sign in"}
      </button>
    </form>
  );
}

const THEME_LABEL: Record<Theme, string> = {
  "sanzo-ember": "ember",
  "sanzo-rose": "rose",
  "sanzo-indigo": "indigo",
  "sanzo-slate": "slate",
  "sanzo-forest": "forest",
  quartz: "quartz",
};
const FONT_LABEL: Record<Font, string> = { departure: "departure", nous: "nous", taurus: "taurus" };
const MODES: LayoutMode[] = ["tiled", "stacked", "monocle"];

interface TopNavProps {
  windows: WinState[];
  activeId: number | null;
  layoutMode: LayoutMode;
  onLayoutMode: (m: LayoutMode) => void;
  onFocus: (id: number) => void;
  onClose: (id: number) => void;
  onReorder: (ids: number[]) => void;
  onHelp: () => void;
}

export function TopNav({ windows, activeId, layoutMode, onLayoutMode, onFocus, onClose, onReorder, onHelp }: TopNavProps) {
  const { theme, setTheme, font, setFont } = useTheme();
  const ids = windows.map((w) => w.id);

  return (
    <nav className="topnav">
      <span className="topnav-brand">HERMETIKA</span>

      <Reorder.Group as="div" axis="x" values={ids} onReorder={onReorder} className="topnav-tabs">
        {windows.map((w) => (
          <Reorder.Item
            key={w.id}
            value={w.id}
            as="div"
            className={`tab ${w.id === activeId ? "active" : ""}`}
            onClick={() => onFocus(w.id)}
            whileDrag={{ scale: 1.04 }}
          >
            <span>{w.model.name}</span>
            <span className="x" onClick={(e) => { e.stopPropagation(); onClose(w.id); }}>×</span>
          </Reorder.Item>
        ))}
      </Reorder.Group>

      <div className="topnav-right">
        <div className="seg">
          {MODES.map((m) => (
            <button key={m} className={layoutMode === m ? "on" : ""} onClick={() => onLayoutMode(m)}>{m}</button>
          ))}
        </div>
        <select className="pick" value={theme} onChange={(e) => setTheme(e.target.value as Theme)} title="theme">
          {THEMES.map((t) => <option key={t} value={t}>{THEME_LABEL[t]}</option>)}
        </select>
        <select className="pick" value={font} onChange={(e) => setFont(e.target.value as Font)} title="font">
          {FONTS.map((f) => <option key={f} value={f}>{FONT_LABEL[f]}</option>)}
        </select>
        <button className="seg-btn" onClick={onHelp} title="keyboard shortcuts (?)">?</button>
        <AuthCluster />
      </div>
    </nav>
  );
}
