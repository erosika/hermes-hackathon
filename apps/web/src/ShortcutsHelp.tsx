const GROUPS: { title: string; rows: [string, string][] }[] = [
  {
    title: "focus",
    rows: [
      ["← / →", "focus prev / next window"],
      ["1 – 9", "focus window N"],
      ["Enter", "focus the model prompt"],
    ],
  },
  {
    title: "arrange",
    rows: [
      ["[ / ]", "move window in stack"],
      ["Alt + ← / →", "move window in stack"],
      ["Alt + Enter", "promote to master"],
      ["\\", "cycle layout (tiled · stacked · monocle)"],
      ["- / =", "shrink / grow master"],
    ],
  },
  {
    title: "window",
    rows: [
      ["↑", "maximize (toggle)"],
      ["↓", "minimize (toggle)"],
      ["Esc", "blur input · else close window"],
      ["?", "toggle this help"],
    ],
  },
];

export function ShortcutsHelp({ onClose }: { onClose: () => void }) {
  return (
    <div className="kbd-backdrop" onClick={onClose}>
      <div className="kbd-help" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <span className="label">keyboard · window manager</span>
          <button className="win-btn close" onClick={onClose} title="close">×</button>
        </div>
        <div className="kbd-groups">
          {GROUPS.map((g) => (
            <div className="kbd-group" key={g.title}>
              <div className="label kbd-group-title">{g.title}</div>
              {g.rows.map(([keys, desc]) => (
                <div className="kbd-row" key={keys}>
                  <span className="kbd-keys">{keys}</span>
                  <span className="kbd-desc">{desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
