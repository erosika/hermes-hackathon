import { useEffect, useState } from "react";
import { getSessions, getSession, type ChatSessionRow, type ChatMessageRow } from "./api";

type Detail = { session: ChatSessionRow; messages: ChatMessageRow[] };

export function SessionArchive({ onClose }: { onClose: () => void }) {
  const [sessions, setSessions] = useState<ChatSessionRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Detail | null>(null);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch((e) => setError(String(e).includes("401") ? "sign in to see your chat history" : "no saved chats yet"));
  }, []);

  return (
    <div className="kbd-backdrop" onClick={onClose}>
      <div className="kbd-help archive" onClick={(e) => e.stopPropagation()}>
        <div className="kbd-head">
          <span className="label">{active ? "transcript" : "chat archive"}</span>
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
          <div className="archive-list">
            {sessions.map((s) => (
              <button key={s.id} className="archive-item" onClick={() => getSession(s.id).then(setActive).catch(() => {})}>
                <span className="name">{s.title || s.model_slug}</span>
                <span className="side-detail">{s.model_slug} · {new Date(s.updated_at).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
