import { type Model, PRICING } from "@hermetika/shared";
import { laneLabel } from "./api";

export function ModelCard({ model, onOpen }: { model: Model; onOpen: (model: Model) => void }) {
  const price = model.priceUsd ?? PRICING.defaultMonthlyUsd;
  const laneClass = model.backend === "gpu" ? "backend-gpu" : "backend-proxy";
  return (
    <div
      className="cell card"
      role="button"
      tabIndex={0}
      onClick={() => onOpen(model)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(model);
        }
      }}
    >
      <span className="name">{model.name}</span>

      <span className="meta">
        <span className="tag kind">{model.kind}</span>
        {model.tags.slice(0, 3).map((t) => (
          <span className="tag" key={t}>{t}</span>
        ))}
      </span>

      <span className={`label ${laneClass}`}>
        {laneLabel(model.backendRef)} · {model.releasedAt}
      </span>

      <span className="card-foot">
        <span className="price">${price}/mo</span>
        <span className="tag card-open" aria-hidden="true">OPEN</span>
      </span>
    </div>
  );
}
