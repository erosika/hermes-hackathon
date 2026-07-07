import { useEffect, useRef, useState } from "react";
import type { Model } from "@hermetika/shared";
import { getModels } from "./api";
import { ThemeProvider } from "./ThemeProvider";
import { AuthProvider, useAuth } from "./AuthProvider";
import { SignInModal } from "./SignInModal";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";
import { Desktop, type WinState } from "./Desktop";
import { StatusBar } from "./StatusBar";
import { ShortcutsHelp } from "./ShortcutsHelp";
import { SessionArchive } from "./SessionArchive";
import { useWindowKeys } from "./useWindowKeys";
import type { LayoutMode } from "./lib/TilingLayoutManager";

const LAYOUTS: LayoutMode[] = ["tiled", "stacked", "monocle"];

// arrived via a password-recovery link → force the set-new-password prompt.
function RecoveryGate() {
  const { recovery, clearRecovery } = useAuth();
  return recovery ? <SignInModal initialMode="reset" onClose={clearRecovery} /> : null;
}
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 768px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const on = () => setM(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return m;
}

export function App() {
  const isMobile = useIsMobile();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [models, setModels] = useState<Model[]>([]);
  const [windows, setWindows] = useState<WinState[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("tiled");
  const [masterRatio, setMasterRatio] = useState(0.55);
  const [showHelp, setShowHelp] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const nextId = useRef(1);

  useEffect(() => {
    const load = () => getModels().then(setModels).catch(() => {});
    void load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, []);

  const openModel = (model: Model) => {
    const existing = windows.find((w) => w.model.slug === model.slug);
    if (existing) {
      setActiveId(existing.id);
      setWindows((ws) => ws.map((w) => (w.id === existing.id ? { ...w, isMinimized: false } : w)));
      return;
    }
    const id = nextId.current++;
    setWindows((ws) => [...ws, { id, model, isMinimized: false, isMaximized: false }]);
    setActiveId(id);
  };

  const focus = (id: number) => {
    setActiveId(id);
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, isMinimized: false } : w)));
  };
  const close = (id: number) =>
    setWindows((ws) => {
      const next = ws.filter((w) => w.id !== id);
      setActiveId((a) => (a === id ? next[next.length - 1]?.id ?? null : a));
      return next;
    });
  const minimize = (id: number) => setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, isMinimized: !w.isMinimized } : w)));
  const maximize = (id: number) => setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized, isMinimized: false } : w)));
  const reorder = (ids: number[]) => setWindows((ws) => ids.map((i) => ws.find((w) => w.id === i)).filter((w): w is WinState => !!w));

  // ── keyboard handlers ──
  const idx = () => windows.findIndex((w) => w.id === activeId);
  const cycleFocus = (dir: -1 | 1) => {
    // skip minimized windows — arrowing onto a collapsed bar shouldn't force-restore it (glitchy half-layout).
    const open = windows.filter((w) => !w.isMinimized);
    if (!open.length) return;
    const cur = open.findIndex((w) => w.id === activeId);
    const n = open[(cur + dir + open.length) % open.length];
    if (n) focus(n.id);
  };
  const moveActive = (dir: -1 | 1) =>
    setWindows((ws) => {
      const i = ws.findIndex((w) => w.id === activeId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= ws.length) return ws;
      const copy = [...ws];
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
      return copy;
    });
  const focusN = (n: number) => { const w = windows[n - 1]; if (w) focus(w.id); };
  const promoteMaster = () =>
    setWindows((ws) => {
      const i = ws.findIndex((w) => w.id === activeId);
      if (i <= 0) return ws;
      const copy = [...ws];
      const [a] = copy.splice(i, 1);
      copy.unshift(a!);
      return copy;
    });
  const cycleLayout = () => setLayoutMode((m) => LAYOUTS[(LAYOUTS.indexOf(m) + 1) % LAYOUTS.length]!);
  const adjustMaster = (d: number) => setMasterRatio((r) => Number(clamp(r + d, 0.2, 0.8).toFixed(2)));
  const focusInput = () => (document.querySelector(".win.active textarea") as HTMLElement | null)?.focus();

  useWindowKeys({
    count: windows.length,
    activeId,
    helpOpen: showHelp,
    cycleFocus,
    moveActive,
    focusN,
    maximize: () => activeId != null && maximize(activeId),
    minimize: () => activeId != null && minimize(activeId),
    close: () => activeId != null && close(activeId),
    focusInput,
    cycleLayout,
    adjustMaster,
    promoteMaster,
    toggleHelp: () => setShowHelp((v) => !v),
  });

  return (
    <ThemeProvider>
      <AuthProvider>
        <div className={`shell${drawerOpen ? " drawer-open" : ""}`}>
          <TopNav
            windows={windows}
            activeId={activeId}
            layoutMode={layoutMode}
            onLayoutMode={setLayoutMode}
            onFocus={focus}
            onClose={close}
            onReorder={reorder}
            onHelp={() => setShowHelp(true)}
            onArchive={() => setShowArchive(true)}
            onMenu={() => setDrawerOpen((v) => !v)}
          />
          <Sidebar
            models={models}
            openSlugs={new Set(windows.map((w) => w.model.slug))}
            onOpen={(m) => { openModel(m); setDrawerOpen(false); }}
            mobileOpen={drawerOpen}
          />
          {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
          <Desktop
            windows={windows}
            activeId={activeId}
            layoutMode={isMobile ? "monocle" : layoutMode}
            masterRatio={masterRatio}
            onFocus={focus}
            onClose={close}
            onMinimize={minimize}
            onMaximize={maximize}
          />
          <StatusBar onArchive={() => setShowArchive(true)} />
        </div>
        {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} />}
        {showArchive && <SessionArchive onClose={() => setShowArchive(false)} />}
        <RecoveryGate />
      </AuthProvider>
    </ThemeProvider>
  );
}
