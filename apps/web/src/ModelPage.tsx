import { useState } from "react";
import { type Model, PRICING } from "@hermetika/shared";
import { createCheckout, laneLabel } from "./api";
import { MercurySigil } from "./MercurySigil";
import { useChatStream } from "./useChatStream";

// per-model sandbox — the demo's hero panel. one accent, hard edges, calm motion.

const DEMO_INFERENCES = 20;

function usd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function ModelPage({ model, onBack }: { model: Model; onBack: () => void }) {
  const { output, streaming, send } = useChatStream();
  const [prompt, setPrompt] = useState("");
  const [used, setUsed] = useState(0);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);

  const price = model.priceUsd ?? PRICING.defaultMonthlyUsd;
  const left = Math.max(0, DEMO_INFERENCES - used);
  const pct = (left / DEMO_INFERENCES) * 100;

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = prompt.trim();
    if (!text || streaming) return;
    setUsed((n) => n + 1);
    void send(model.slug, text);
  };

  const onSubscribe = async () => {
    try {
      const session = await createCheckout(model.slug);
      setCheckoutUrl(session.url);
      window.open(session.url, "_blank", "noopener");
    } catch {
      setCheckoutUrl(null);
    }
  };

  return (
    <section className="sandbox">
      <div className="sandbox-header">
        <div className="sandbox-id">
          <button className="back-btn" onClick={onBack}>← back</button>
          <span className="label">model</span>
          <span className="name">{model.name}</span>
          <MercurySigil size={80} accent />
        </div>
        <button className="sub-btn" onClick={onSubscribe}>
          sub {usd(price)}/mo
        </button>
      </div>

      <div className="sandbox-meta">
        <span className="tag kind">{model.kind}</span>
        <span className={`label ${model.backend === "gpu" ? "backend-gpu" : "backend-proxy"}`}>
          backend · {laneLabel(model.backendRef)}
        </span>
      </div>

      <form className="playground" onSubmit={onSubmit}>
        <label className="label" htmlFor="pg-in">prompt</label>
        <textarea
          id="pg-in"
          className="playground-in"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="speak to the model"
          rows={3}
        />
        <div className="playground-actions">
          <button className="sub-btn" type="submit" disabled={streaming || left === 0}>
            {streaming ? "streaming…" : "run"}
          </button>
          {checkoutUrl && <span className="label">checkout · {checkoutUrl}</span>}
        </div>
        <pre className="playground-out">{output || (streaming ? "…" : "output appears here")}</pre>
      </form>

      <div className="meter">
        <div className="meter-head">
          <span className="label">quota</span>
          <span className="label">{left} inferences left</span>
        </div>
        <div className="quota-bar">
          <div className="quota-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="meter-row">
          <div className="readout ok">
            <span className="label">float</span>
            <span className="digits sm">{usd(0)}</span>
          </div>
          <div className="readout ok">
            <span className="label">today</span>
            <span className="digits sm">+{usd(0)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
