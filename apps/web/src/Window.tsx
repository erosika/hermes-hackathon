import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import type { WindowBounds } from "./lib/TilingLayoutManager";

interface WindowProps {
  title: string;
  bounds: WindowBounds;
  active: boolean;
  minimized: boolean;
  children: ReactNode;
  onFocus: () => void;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
}

export function Window({ title, bounds, active, minimized, children, onFocus, onClose, onMinimize, onMaximize }: WindowProps) {
  const reduce = useReducedMotion();
  const minClass = minimized ? (bounds.minimizeType === "vertical" ? "min-vertical" : "min-horizontal") : "";

  // snappy spring toward the tiled bounds; frozen to an instant cut for reduced-motion.
  const transition = reduce
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 380, damping: 34, mass: 0.8 };

  return (
    <motion.div
      className={`win ${active ? "active" : ""} ${minClass}`}
      onMouseDown={onFocus}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={transition}
      style={{ zIndex: active ? 20 : 10 }}
    >
      <div className="win-titlebar" onDoubleClick={onMaximize}>
        <span className="win-title">{title}</span>
        <div className="win-actions">
          <button className="win-btn" title="minimize" onClick={(e) => { e.stopPropagation(); onMinimize(); }}>–</button>
          <button className="win-btn" title="maximize" onClick={(e) => { e.stopPropagation(); onMaximize(); }}>▢</button>
          <button className="win-btn close" title="close" onClick={(e) => { e.stopPropagation(); onClose(); }}>×</button>
        </div>
      </div>
      <div className="win-body">{children}</div>
    </motion.div>
  );
}
