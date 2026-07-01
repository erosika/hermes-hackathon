import { useState } from "react";
import { Reorder } from "framer-motion";
import { THEMES, FONTS, useTheme, type Theme, type Font } from "./ThemeProvider";
import { useAuth } from "./AuthProvider";
import type { LayoutMode } from "./lib/TilingLayoutManager";
import type { WinState } from "./Desktop";

function AuthCluster() {
  const { email, subscribed, login, logout } = useAuth();
  const [draft, setDraft] = useState("");
  if (email) {
    return (
      <div className="auth">
        <span className={`badge ${subscribed ? "pro" : "free"}`}>{subscribed ? "pro" : "free"}</span>
        <span className="label auth-email">{email}</span>
        <button className="seg-btn" onClick={() => void logout()}>sign out</button>
      </div>
    );
  }
  return (
    <form
      className="auth"
      onSubmit={(e) => { e.preventDefault(); if (draft.trim()) void login(draft.trim()); }}
    >
      <input className="pick auth-in" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="email" type="email" />
      <button className="seg-btn" type="submit">sign in</button>
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
}

export function TopNav({ windows, activeId, layoutMode, onLayoutMode, onFocus, onClose, onReorder }: TopNavProps) {
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
        <AuthCluster />
      </div>
    </nav>
  );
}
