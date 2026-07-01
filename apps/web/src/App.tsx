import { useEffect, useRef, useState } from "react";
import type { Model } from "@hermetika/shared";
import { getModels } from "./api";
import { ThemeProvider } from "./ThemeProvider";
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
    // pantheon can grow live via the nudge flow; poll so new admissions appear.
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
  const maximize = (id: number) =>
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, isMaximized: !w.isMaximized, isMinimized: false } : w)));

  return (
    <ThemeProvider>
      <div className="shell">
        <TopNav
          windows={windows}
          activeId={activeId}
          layoutMode={layoutMode}
          onLayoutMode={setLayoutMode}
          onFocus={focus}
          onClose={close}
        />
        <Sidebar models={models} openSlugs={new Set(windows.map((w) => w.model.slug))} onOpen={openModel} />
        <Desktop
          windows={windows}
          activeId={activeId}
          layoutMode={layoutMode}
          onFocus={focus}
          onClose={close}
          onMinimize={minimize}
          onMaximize={maximize}
        />
        <StatusBar />
      </div>
    </ThemeProvider>
  );
}
