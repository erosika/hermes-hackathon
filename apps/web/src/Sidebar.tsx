import { useState } from "react";
import type { Model } from "@hermetika/shared";

type SModel = Model & { author?: string | null; resident?: boolean; hfUrl?: string | null };

interface SidebarProps {
  models: SModel[];
  openSlugs: Set<string>;
  onOpen: (model: Model) => void;
  mobileOpen?: boolean;
}

const CATEGORY_ORDER = ["ascii", "art", "esoteric", "tech", "story", "puzzle", "wordplay", "music", "visual", "uncategorized"];

export function Sidebar({ models, openSlugs, onOpen, mobileOpen }: SidebarProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (cat: string) =>
    setCollapsed((s) => { const n = new Set(s); n.has(cat) ? n.delete(cat) : n.add(cat); return n; });

  const groups = new Map<string, SModel[]>();
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
    <aside className={`sidebar${mobileOpen ? " mobile-open" : ""}`}>
      <div className="side-head">
        <span className="label">models</span>
        <span className="label">{models.length}</span>
      </div>
      {cats.map((cat) => {
        const isOpen = !collapsed.has(cat);
        return (
          <div key={cat} className="side-group">
            <button className="side-cat" onClick={() => toggle(cat)}>
              <span className="label"><span className="side-chevron">{isOpen ? "▾" : "▸"}</span> {cat}</span>
              <span className="label">{groups.get(cat)!.length}</span>
            </button>
            {isOpen && groups.get(cat)!.map((m) => {
              const detail = [m.params, m.author].filter(Boolean).join(" · ");
              return (
                <div key={m.id} className={`side-item ${openSlugs.has(m.slug) ? "open" : ""}`}>
                  <button className="side-open" onClick={() => onOpen(m)}>
                    <span className="name">{m.name}</span>
                    <span className="side-detail">
                      {m.resident !== undefined && <span className={`dot ${m.resident ? "on" : "off"}`} />}
                      {detail || m.kind}
                    </span>
                  </button>
                  {m.hfUrl && (
                    <a className="side-hf" href={m.hfUrl} target="_blank" rel="noopener noreferrer" title="hugging face">↗</a>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="scroll-hint">▾</div>
    </aside>
  );
}
