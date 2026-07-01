import { useEffect } from "react";

// tiling-WM keyboard control. all shortcuts ignore keystrokes while typing in a field,
// except Escape (which blurs the field first, then closes the window on a second press).
export interface WindowKeyHandlers {
  count: number;
  activeId: number | null;
  helpOpen: boolean;
  cycleFocus: (dir: -1 | 1) => void;
  moveActive: (dir: -1 | 1) => void;
  focusN: (n: number) => void;
  maximize: () => void;
  minimize: () => void;
  close: () => void;
  focusInput: () => void;
  cycleLayout: () => void;
  adjustMaster: (delta: number) => void;
  promoteMaster: () => void;
  toggleHelp: () => void;
}

function typing(): boolean {
  const el = document.activeElement as HTMLElement | null;
  return !!el && (el.tagName === "TEXTAREA" || el.tagName === "INPUT" || el.tagName === "SELECT" || el.isContentEditable);
}

export function useWindowKeys(h: WindowKeyHandlers): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // when the cheatsheet is open, keys only close it
      if (h.helpOpen) {
        if (e.key === "Escape" || e.key === "?") { e.preventDefault(); h.toggleHelp(); }
        return;
      }
      if (e.key === "Escape") {
        if (typing()) { (document.activeElement as HTMLElement).blur(); return; }
        if (h.activeId != null) { e.preventDefault(); h.close(); }
        return;
      }
      if (typing()) return;
      if (e.key === "?") { e.preventDefault(); h.toggleHelp(); return; }
      if (h.count === 0) return;

      switch (e.key) {
        case "ArrowLeft": e.preventDefault(); e.altKey ? h.moveActive(-1) : h.cycleFocus(-1); break;
        case "ArrowRight": e.preventDefault(); e.altKey ? h.moveActive(1) : h.cycleFocus(1); break;
        case "[": e.preventDefault(); h.moveActive(-1); break;
        case "]": e.preventDefault(); h.moveActive(1); break;
        case "ArrowUp": e.preventDefault(); h.maximize(); break;
        case "ArrowDown": e.preventDefault(); h.minimize(); break;
        case "Enter": e.preventDefault(); e.altKey ? h.promoteMaster() : h.focusInput(); break;
        case "\\": e.preventDefault(); h.cycleLayout(); break;
        case "-": case "_": e.preventDefault(); h.adjustMaster(-0.05); break;
        case "=": case "+": e.preventDefault(); h.adjustMaster(0.05); break;
        case "h": case "H": if (e.altKey) { e.preventDefault(); h.adjustMaster(-0.05); } break;
        case "l": case "L": if (e.altKey) { e.preventDefault(); h.adjustMaster(0.05); } break;
        default:
          if (/^[1-9]$/.test(e.key)) { e.preventDefault(); h.focusN(Number(e.key)); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [h]);
}
