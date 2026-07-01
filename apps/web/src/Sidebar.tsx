import type { Model } from "@hermetika/shared";
import { laneLabel } from "./api";

interface SidebarProps {
  models: Model[];
  openSlugs: Set<string>;
  onOpen: (model: Model) => void;
}

export function Sidebar({ models, openSlugs, onOpen }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="side-head">
        <span className="label">pantheon</span>
        <span className="label">{models.length}</span>
      </div>
      {models.map((m) => (
        <button
          key={m.id}
          className={`side-item ${openSlugs.has(m.slug) ? "open" : ""}`}
          onClick={() => onOpen(m)}
        >
          <span className="name">{m.name}</span>
          <span className="meta">
            <span className="tag kind">{m.kind}</span>
            <span className={`label ${m.backend === "gpu" ? "backend-gpu" : "backend-proxy"}`}>{laneLabel(m.backendRef)}</span>
          </span>
        </button>
      ))}
    </aside>
  );
}
