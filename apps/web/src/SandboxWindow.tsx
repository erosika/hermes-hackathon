import { useEffect, useRef, useState } from "react";
import { type Model, type ChatMessage, PRICING } from "@hermetika/shared";
import { laneLabel } from "./api";
import { useChatStream } from "./useChatStream";
import { MercurySigil } from "./MercurySigil";

const DEMO_INFERENCES = 20;

export function SandboxWindow({ model, models, onSwap }: { model: Model; models: Model[]; onSwap: (m: Model) => void }) {
  const { output, streaming, error, send, reset } = useChatStream();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [used, setUsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // swapping the window's model starts a fresh transcript.
  useEffect(() => { reset(); setMessages([]); setUsed(0); }, [model.slug, reset]);
  // keep the transcript pinned to the latest turn.
  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, output]);

  const price = model.priceUsd ?? PRICING.defaultMonthlyUsd;
  const left = Math.max(0, DEMO_INFERENCES - used);
  const pct = (left / DEMO_INFERENCES) * 100;

  const fire = async () => {
    const text = prompt.trim();
    if (!text || streaming || left === 0) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(next);
    setPrompt("");
    setUsed((n) => n + 1);
    const reply = await send(model.slug, next);
    if (reply) setMessages((m) => [...m, { role: "assistant", content: reply }]);
  };
  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); void fire(); };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void fire(); }
  };

  return (
    <div className="sbx">
      <div className="sbx-meta">
        <div className="sigil"><MercurySigil size={40} accent /></div>
        <div className="sbx-id">
          <h2 className="sbx-model">{model.name}</h2>
          <span className="sbx-lane label">
            <span className={model.backend === "gpu" ? "backend-gpu" : "backend-proxy"}>{laneLabel(model.backendRef)}</span> · ${price}/mo
          </span>
        </div>
        <select
          className="pick sbx-swap"
          value={model.slug}
          onChange={(e) => { const m = models.find((x) => x.slug === e.target.value); if (m) onSwap(m); }}
          title="swap model"
        >
          {models.map((m) => <option key={m.slug} value={m.slug}>{m.name}</option>)}
        </select>
      </div>

      <div className="transcript" ref={scrollRef}>
        {messages.length === 0 && !streaming && <div className="transcript-empty label">speak to the model — enter to send</div>}
        {messages.map((m, i) => (
          <div className={`msg ${m.role}`} key={i}>
            <span className="msg-role label">{m.role === "user" ? "you" : model.name}</span>
            <div className="msg-body">{m.content}</div>
          </div>
        ))}
        {streaming && (
          <div className="msg assistant">
            <span className="msg-role label">{model.name}</span>
            <div className="msg-body">{output || "…"}</div>
          </div>
        )}
        {error && <div className="msg-error label">error · {error}</div>}
      </div>

      <form className="playground" onSubmit={onSubmit}>
        <textarea
          className="playground-in"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKey}
          placeholder="prompt · enter to send · shift+enter for newline"
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
