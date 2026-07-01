import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import type { Model } from "@hermetika/shared";
import { TilingLayoutManager, type LayoutMode } from "./lib/TilingLayoutManager";
import { Window } from "./Window";
import { SandboxWindow } from "./SandboxWindow";

export interface WinState {
  id: number;
  model: Model;
  isMinimized: boolean;
  isMaximized: boolean;
}

interface DesktopProps {
  windows: WinState[];
  activeId: number | null;
  layoutMode: LayoutMode;
  onFocus: (id: number) => void;
  onClose: (id: number) => void;
  onMinimize: (id: number) => void;
  onMaximize: (id: number) => void;
}

export function Desktop({ windows, activeId, layoutMode, onFocus, onClose, onMinimize, onMaximize }: DesktopProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const mgr = useMemo(() => new TilingLayoutManager({ topBarHeight: 0, gaps: { inner: 8, outer: 8 } }), []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const e = entries[0];
      if (e) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  mgr.setLayoutMode(layoutMode);
  const bounds = size.w
    ? mgr.calculateLayout(
        windows.map((w) => ({ id: w.id, isMinimized: w.isMinimized, isMaximized: w.isMaximized })),
        size.w,
        size.h,
      )
    : new Map();

  return (
    <div className="desktop" ref={ref}>
      {windows.length === 0 && (
        <div className="desktop-empty label">pick a model from the pantheon to open a sandbox</div>
      )}
      <AnimatePresence>
        {windows.map((w) => {
          const b = bounds.get(w.id);
          if (!b) return null;
          return (
            <Window
              key={w.id}
              title={w.model.name}
              bounds={b}
              active={w.id === activeId}
              minimized={w.isMinimized}
              onFocus={() => onFocus(w.id)}
              onClose={() => onClose(w.id)}
              onMinimize={() => onMinimize(w.id)}
              onMaximize={() => onMaximize(w.id)}
            >
              <SandboxWindow model={w.model} />
            </Window>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
