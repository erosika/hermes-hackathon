import { useEffect, useState } from "react";
import type { Model } from "@hermetika/shared";
import { getModels, laneLabel } from "./api";
import { LedgerMeter } from "./LedgerMeter";

export function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    getModels()
      .then(setModels)
      .catch((e) => setErr(String(e)));
  }, []);

  return (
    <div className="chassis">
      <header className="bar">
        <span className="mark">HERMETIKA</span>
        <span className="label">model pantheon · operated by hermes</span>
      </header>

      <LedgerMeter />

      <div className="label" style={{ margin: "16px 0" }}>
        pantheon — {models.length} models
      </div>

      {err && <div className="label">offline · {err}</div>}

      <div className="grid">
        {models.map((m) => (
          <div className="cell" key={m.id}>
            <span className="name">{m.name}</span>
            <span className={`tag kind`}>{m.kind}</span>
            <span className="meta">
              {m.tags.map((t) => (
                <span className="tag" key={t}>{t}</span>
              ))}
            </span>
            <span
              className={`label ${m.backend === "gpu" ? "backend-gpu" : "backend-proxy"}`}
              style={{ marginTop: "auto" }}
            >
              {laneLabel(m.backendRef)} · {m.releasedAt}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
