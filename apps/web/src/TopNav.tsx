import { THEMES, useTheme, type Theme } from "./ThemeProvider";
import type { LayoutMode } from "./lib/TilingLayoutManager";
import type { WinState } from "./Desktop";

const THEME_LABEL: Record<Theme, string> = {
  "workstation-dark": "dark",
  "workstation-light": "light",
  quartz: "quartz",
  sanzo: "sanzo",
};

const MODES: LayoutMode[] = ["tiled", "stacked", "monocle"];

interface TopNavProps {
  windows: WinState[];
  activeId: number | null;
  layoutMode: LayoutMode;
  onLayoutMode: (m: LayoutMode) => void;
  onFocus: (id: number) => void;
  onClose: (id: number) => void;
}

export function TopNav({ windows, activeId, layoutMode, onLayoutMode, onFocus, onClose }: TopNavProps) {
  const { theme, setTheme } = useTheme();

  return (
    <nav className="topnav">
      <span className="topnav-brand">HERMETIKA</span>

      <div className="topnav-tabs">
        {windows.map((w) => (
          <div key={w.id} className={`tab ${w.id === activeId ? "active" : ""}`} onClick={() => onFocus(w.id)}>
            <span>{w.model.name}</span>
            <span className="x" onClick={(e) => { e.stopPropagation(); onClose(w.id); }}>×</span>
          </div>
        ))}
      </div>

      <div className="topnav-right">
        <div className="seg">
          {MODES.map((m) => (
            <button key={m} className={layoutMode === m ? "on" : ""} onClick={() => onLayoutMode(m)}>{m}</button>
          ))}
        </div>
        <div className="seg">
          {THEMES.map((t) => (
            <button key={t} className={theme === t ? "on" : ""} onClick={() => setTheme(t)}>{THEME_LABEL[t]}</button>
          ))}
        </div>
      </div>
    </nav>
  );
}
