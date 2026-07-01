import { useEffect, useState } from "react";
import type { Model } from "@hermetika/shared";
import { getModels } from "./api";
import { LedgerMeter } from "./LedgerMeter";
import { PantheonGrid } from "./PantheonGrid";
import { ModelPage } from "./ModelPage";

export function App() {
  const [models, setModels] = useState<Model[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Model | null>(null);

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

      {err && <div className="label">offline · {err}</div>}

      {open ? (
        <ModelPage model={open} onBack={() => setOpen(null)} />
      ) : (
        <PantheonGrid models={models} onOpen={setOpen} />
      )}
    </div>
  );
}
