import { useEffect, useRef, useState } from "react";
import { type Model, type ChatMessage } from "@hermetika/shared";
import { useChatStream } from "./useChatStream";
import { useAuth } from "./AuthProvider";
import { MercurySigil } from "./MercurySigil";

const FREE_PER_MODEL = 5; // mirrors the gateway's FREE.perModel, for the quota bar

// model carries extra fields the gateway attaches beyond the shared type.
type FullModel = Model & { hfUrl?: string | null; resident?: boolean };

export function SandboxWindow({ model }: { model: FullModel }) {
  const { output, streaming, error, remaining, pro, send, reset } = useChatStream();
  const { subscribed } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const pinned = useRef(true); // stick to bottom until the user scrolls up to read

  useEffect(() => { reset(); setMessages([]); pinned.current = true; }, [model.slug, reset]);
  useEffect(() => { if (pinned.current) scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight }); }, [messages, output]);

  // a scroll away from the bottom unpins; scrolling back to the bottom re-pins.
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  // pro is known at page load via /api/auth/me — don't wait for the first response header to say so.
  const isPro = pro || subscribed;
  const spent = !isPro && remaining === 0;
  const pct = remaining == null ? 100 : (remaining / FREE_PER_MODEL) * 100;

  const fire = async () => {
    const text = prompt.trim();
    if (!text || streaming || spent) return;
    const next: ChatMessage[] = [...messages, { role: "user", content: text }];
    pinned.current = true; // re-pin on send so the new turn scrolls into view
    setMessages(next);
    setPrompt("");
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
          <span className="sbx-info label">
            {model.resident !== undefined && <span className={`dot ${model.resident ? "on" : "off"}`} />}
            {[model.params, model.author, model.license, model.kind, model.releasedAt].filter(Boolean).join(" · ")}
            {model.hfUrl && <> · <a href={model.hfUrl} target="_blank" rel="noopener noreferrer">hf ↗</a></>}
          </span>
        </div>
      </div>

      <div className="transcript" ref={scrollRef} onScroll={onScroll}>
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
        {error && <div className="msg-error label">{error}</div>}
      </div>

      <form className="playground" onSubmit={onSubmit}>
        <textarea
          className="playground-in"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={onKey}
          placeholder="prompt · enter to send · shift+enter for newline"
          rows={2}
          disabled={spent}
        />
        <div className="playground-actions">
          <button className="sub-btn" type="submit" disabled={streaming || spent}>
            {streaming ? "streaming…" : "run"}
          </button>
          {!isPro && (
            <>
              <div className="quota-bar" style={{ flex: 1 }}>
                <div className={`quota-fill ${pct <= 20 ? "low" : ""}`} style={{ width: `${pct}%` }} />
              </div>
              <span className="label">{`${remaining ?? FREE_PER_MODEL}/${FREE_PER_MODEL} free · this model`}</span>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
