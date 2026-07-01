import { useEffect, useState } from "react";
import { type Model, PRICING } from "@hermetika/shared";
import { laneLabel } from "./api";
import { useChatStream } from "./useChatStream";
import { MercurySigil } from "./MercurySigil";

const DEMO_INFERENCES = 20;

export function SandboxWindow({ model, models, onSwap }: { model: Model; models: Model[]; onSwap: (m: Model) => void }) {
  const { output, streaming, error, send, reset } = useChatStream();
  const [prompt, setPrompt] = useState("");
  const [used, setUsed] = useState(0);

  // swapping the window's model starts a fresh transcript.
  useEffect(() => { reset(); }, [model.slug, reset]);

  const price = model.priceUsd ?? PRICING.defaultMonthlyUsd;
  const left = Math.max(0, DEMO_INFERENCES - used);
  const pct = (left / DEMO_INFERENCES) * 100;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || streaming || left === 0) return;
    setUsed((n) => n + 1);
    void send(model.slug, text);
  };

  return (
    <div className="sbx">
      <div className="sbx-meta">
        <div className="sigil"><MercurySigil size={40} accent /></div>
        <select
          className="pick"
          value={model.slug}
          onChange={(e) => { const m = models.find((x) => x.slug === e.target.value); if (m) onSwap(m); }}
          title="swap model"
        >
          {models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
        </select>
        <span className={`label ${model.backend === "gpu" ? "backend-gpu" : "backend-proxy"}`}>{laneLabel(model.backendRef)}</span>
        <span className="sbx-price">${price}/mo</span>
      </div>

      <form className="playground" onSubmit={onSubmit}>
        <div className={`playground-out ${error ? "err" : ""}`}>
          {error ? `error · ${error}` : output || (streaming ? "…" : "speak to the model")}
        </div>
        <textarea
          className="playground-in"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="prompt"
          rows={2}
        />
        <div className="playground-actions">
          <button className="sub-btn" type="submit" disabled={streaming || left === 0}>
            {streaming ? "streaming…" : "run"}
          </button>
          <div className="quota-bar" style={{ flex: 1 }}>
            <div className={`quota-fill ${pct <= 20 ? "low" : ""}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="label">{left} left</span>
        </div>
      </form>
    </div>
  );
}
