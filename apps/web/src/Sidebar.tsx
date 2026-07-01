import type { Model } from "@hermetika/shared";
import { laneLabel } from "./api";

interface SidebarProps {
  models: Model[];
  openSlugs: Set<string>;
  onOpen: (model: Model) => void;
}

const CATEGORY_ORDER = ["esoteric", "ascii", "art", "tech", "story", "puzzle", "wordplay", "music", "visual", "uncategorized"];

export function Sidebar({ models, openSlugs, onOpen }: SidebarProps) {
  const groups = new Map<string, Model[]>();
  for (const m of models) {
    const k = m.kind ?? "uncategorized";
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(m);
  }
  const cats = [...groups.keys()].sort((a, b) => {
    const ia = CATEGORY_ORDER.indexOf(a);
    const ib = CATEGORY_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });

  return (
    <aside className="sidebar">
      <div className="side-head">
        <span className="label">models</span>
        <span className="label">{models.length}</span>
      </div>
      {cats.map((cat) => (
        <div key={cat} className="side-group">
          <div className="side-cat">
            <span className="label">{cat}</span>
            <span className="label">{groups.get(cat)!.length}</span>
          </div>
          {groups.get(cat)!.map((m) => (
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
        </div>
      ))}
    </aside>
  );
}
