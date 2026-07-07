import { useEffect, useMemo, useState } from "react";
import { getSessions, getSession, type ChatSessionRow, type ChatMessageRow } from "./api";

type Detail = { session: ChatSessionRow; messages: ChatMessageRow[] };

export function SessionArchive({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<ChatSessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Detail | null>(null);
  const [q, setQ] = useState("");
  const [model, setModel] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((e) => setError(String(e).includes("401") ? "sign in to see your chat history" : "no saved chats yet"));
  }, []);

  const modelsSeen = useMemo(
    () => [...new Set((sessions ?? []).map((s) => s.model_slug))].sort(),
    [sessions],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (sessions ?? []).filter((s) => {
      if (model !== "all" && s.model_slug !== model) return false;
      const day = s.updated_at.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (needle && !`${s.title ?? ""} ${s.model_slug}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [sessions, q, model, from, to]);

  return (
    <div className="kbd-backdrop" onClick={onClose}>
      <div className="kbd-help archive" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <span className="label">{active ? "transcript" : "past sessions"}</span>
          <button className="win-btn close" onClick={onClose} title="close">×</button>
        </div>

        {active ? (
          <div className="archive-view">
            <button className="seg-btn" onClick={() => setActive(null)}>← sessions</button>
            <div className="label archive-meta">{active.session.model_slug} · {new Date(active.session.updated_at).toLocaleString()}</div>
            <div className="archive-transcript">
              {active.messages.map((m) => (
                <div key={m.id} className={`archive-msg ${m.role}`}>
                  <span className="label">{m.role}</span>
                  <div className="archive-content">{m.content}</div>
                </div>
              ))}
            </div>
          </div>
        ) : error ? (
          <div className="archive-empty label">{error}</div>
        ) : !sessions ? (
          <div className="archive-empty label">loading…</div>
        ) : sessions.length === 0 ? (
          <div className="archive-empty label">no saved chats yet</div>
        ) : (
          <>
            <div className="archive-filters">
              <input
                className="pick archive-q"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="search topics…"
                autoFocus
              />
              <select className="pick" value={model} onChange={(e) => setModel(e.target.value)} title="filter by model">
                <option value="all">all models</option>
                {modelsSeen.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
              <input className="pick" type="date" value={from} onChange={(e) => setFrom(e.target.value)} title="from" />
              <input className="pick" type="date" value={to} onChange={(e) => setTo(e.target.value)} title="to" />
            </div>
            {shown.length === 0 ? (
              <div className="archive-empty label">nothing matches</div>
            ) : (
              <div className="archive-list">
                {shown.map((s) => (
                  <button key={s.id} className="archive-item" onClick={() => getSession(s.id).then(setActive).catch(() => {})}>
                    <span className="name">{s.title || s.model_slug}</span>
                    <span className="side-detail">{s.model_slug} · {new Date(s.updated_at).toLocaleDateString()}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
