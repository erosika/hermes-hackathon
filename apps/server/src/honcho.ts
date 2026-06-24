// Honcho — two jobs: session manager for talk-to-models chats + operator peer memory.
// stub for D1; real SDK wiring lands D3 when chats persist. one rule:
// money + registry → Supabase; conversation + agent cognition → Honcho.

import type { ChatMessage } from "@hermetika/shared";

const WORKSPACE = process.env.HONCHO_WORKSPACE ?? "hermetika";

export interface HonchoSession {
  id: string;
  workspace: string;
}

// records a turn (user + assistant) onto a session. no-op until SDK is wired.
export async function recordTurn(
  _sessionId: string,
  _user: ChatMessage,
  _assistant: ChatMessage,
): Promise<void> {
  if (!process.env.HONCHO_API_KEY) return; // dev: skip silently
  // TODO(D3): honcho.session(sessionId).addMessages([...])
}

export function newSession(id: string): HonchoSession {
  return { id, workspace: WORKSPACE };
}
