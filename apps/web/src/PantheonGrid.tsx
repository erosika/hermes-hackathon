import type { Model } from "@hermetika/shared";
import { ModelCard } from "./ModelCard";

export function PantheonGrid({
  models,
  onOpen,
}: {
  models: Model[];
  onOpen: (model: Model) => void;
}) {
  return (
    <div>
      <div className="label" style={{ margin: "16px 0" }}>
        pantheon — {models.length} models
      </div>
      <div className="grid">
        {models.map((m) => (
          <ModelCard model={m} onOpen={onOpen} key={m.id} />
        ))}
      </div>
    </div>
  );
}
