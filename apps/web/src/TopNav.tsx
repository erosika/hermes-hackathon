import { useState } from "react";
import { Reorder } from "framer-motion";
import { THEMES, useTheme, type Theme } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import { AccountMenu } from "./AccountMenu";
import { SignInModal } from "./SignInModal";
import type { LayoutMode } from "./lib/TilingLayoutManager";
import type { WinState } from "./Desktop";

function AuthCluster() {
  const { email, subscribed, configured } = useAuth();
  const [account, setAccount] = useState(false);
  const [signin, setSignin] = useState(false);

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

  return (
    <>
      <button className="seg-btn" onClick={() => setSignin(true)}>sign in</button>
      {signin && <SignInModal onClose={() => setSignin(false)} />}
    </>
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
  onArchive?: () => void;
  onMenu?: () => void;
}

export function TopNav({ windows, activeId, layoutMode, onLayoutMode, onFocus, onClose, onReorder, onHelp, onArchive, onMenu }: TopNavProps) {
  const { theme, setTheme } = useTheme();
  const ids = windows.map((w) => w.id);

  return (
    <nav className="topnav">
      <button className="menu-btn" onClick={onMenu} title="models" aria-label="toggle models">☰</button>
      <div className="brandwrap">
        <span className="topnav-brand">☿ HERMETIKA</span>
        <span className="tagline">eri's atlas of models</span>
      </div>

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
        <button className="seg-btn" onClick={onArchive} title="chat archive">⌗</button>
        <button className="seg-btn" onClick={onHelp} title="keyboard shortcuts (?)">?</button>
        <AuthCluster />
      </div>
    </nav>
  );
}
