import { useEffect, useRef, useState } from "react";
import type { Model } from "@hermetika/shared";
import { getModels } from "./api";
import { ThemeProvider } from "./ThemeProvider";
import { AuthProvider } from "./AuthProvider";
import { TopNav } from "./TopNav";
import { Sidebar } from "./Sidebar";
import { Desktop, type WinState } from "./Desktop";
import { StatusBar } from "./StatusBar";
import type { LayoutMode } from "./lib/TilingLayoutManager";

export function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [windows, setWindows] = useState<WinState[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("tiled");
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
  const swapModel = (id: number, model: Model) => setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, model } : w)));
  const reorder = (ids: number[]) => setWindows((ws) => ids.map((i) => ws.find((w) => w.id === i)).filter((w): w is WinState => !!w));

  // keyboard controls — ignored while typing in a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "TEXTAREA" || t.tagName === "INPUT" || t.tagName === "SELECT")) return;
      if (!windows.length) return;
      const i = windows.findIndex((w) => w.id === activeId);
      if (e.key === "Escape" && activeId != null) { close(activeId); }
      else if (e.key === "]") { const n = windows[(i + 1) % windows.length]; if (n) focus(n.id); }
      else if (e.key === "[") { const n = windows[(i - 1 + windows.length) % windows.length]; if (n) focus(n.id); }
      else if ((e.metaKey || e.ctrlKey) && (e.key === "m" || e.key === "M") && activeId != null) { e.preventDefault(); minimize(activeId); }
      else if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && activeId != null) { e.preventDefault(); maximize(activeId); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [windows, activeId]);

  return (
    <ThemeProvider>
      <AuthProvider>
      <div className="shell">
        <TopNav
          windows={windows}
          activeId={activeId}
          layoutMode={layoutMode}
          onLayoutMode={setLayoutMode}
          onFocus={focus}
          onClose={close}
          onReorder={reorder}
        />
        <Sidebar models={models} openSlugs={new Set(windows.map((w) => w.model.slug))} onOpen={openModel} />
        <Desktop
          windows={windows}
          models={models}
          activeId={activeId}
          layoutMode={layoutMode}
          onFocus={focus}
          onClose={close}
          onMinimize={minimize}
          onMaximize={maximize}
          onSwapModel={swapModel}
        />
        <StatusBar />
      </div>
      </AuthProvider>
    </ThemeProvider>
  );
}
