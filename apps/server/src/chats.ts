// chat transcript persistence — Supabase is system-of-record; degrade-safe (no db → no-op).
// Honcho, when wired, is the memory layer fed the same turns — not the transcript store.
import { getDb } from "./db";

type Row = Record<string, unknown>;
type Query = { insert: Function; update: Function; select: Function };
const table = (db: unknown, name: string) => (db as { from(t: string): Query }).from(name);

export async function ensureSession(id: string, userEmail: string, modelSlug: string, title?: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  try {
    const { data: existing } = await table(db, "chat_sessions").select("user_email").eq("id", id).maybeSingle();
    if (existing) {
      if (existing.user_email !== userEmail) return; // someone else's session id — never reassign
      await table(db, "chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", id);
      return;
    }
    // title is set once at creation — the opening ask is the session's summary
    await table(db, "chat_sessions").insert({ id, user_email: userEmail, model_slug: modelSlug, title: title ?? null });
  } catch (e) {
    console.error("chats: ensureSession failed", e);
  }
}

export async function appendMessages(
  sessionId: string,
  userEmail: string,
  msgs: { role: string; content: string; tokens?: number }[],
): Promise<void> {
  const db = await getDb();
  if (!db || msgs.length === 0) return;
  try {
    const { data: session } = await table(db, "chat_sessions").select("user_email").eq("id", sessionId).maybeSingle();
    if (!session || session.user_email !== userEmail) return; // no writes into foreign or missing sessions
    const now = Date.now();
    const rows: Row[] = msgs.map((m, i) => ({
      id: `${sessionId}:${now}:${i}`,
      session_id: sessionId,
      role: m.role,
      content: m.content,
      tokens: m.tokens ?? null,
    }));
    await table(db, "chat_messages").insert(rows);
    await table(db, "chat_sessions").update({ updated_at: new Date().toISOString() }).eq("id", sessionId);
  } catch (e) {
    console.error("chats: appendMessages failed", e);
  }
}

export async function listSessions(userEmail: string): Promise<Row[]> {
  const db = await getDb();
  if (!db) return [];
  const { data } = await table(db, "chat_sessions")
    .select("*")
    .eq("user_email", userEmail)
    .order("updated_at", { ascending: false })
    .limit(100);
  return data ?? [];
}

export async function getSessionMessages(id: string, userEmail: string): Promise<{ session: Row; messages: Row[] } | null> {
  const db = await getDb();
  if (!db) return null;
  const { data: session } = await table(db, "chat_sessions").select("*").eq("id", id).eq("user_email", userEmail).maybeSingle();
  if (!session) return null;
  const { data: messages } = await table(db, "chat_messages").select("*").eq("session_id", id).order("created_at", { ascending: true });
  return { session, messages: messages ?? [] };
}
