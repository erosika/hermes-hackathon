import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@hermetika/shared";
import { authHeader } from "./supabase";
import { API_BASE } from "./config";

interface StreamDelta {
  choices?: { delta?: { content?: string } }[];
}

// keep sent input under the gateway's MAX_INPUT_CHARS (24000) so multi-turn chats don't 413.
const INPUT_CHAR_BUDGET = 22000;

// drop oldest turns until the total fits the budget; the newest message always survives
// (even if it alone exceeds — the gateway then returns a clean 413 we surface to the user).
function trimToBudget(messages: ChatMessage[], budget: number): ChatMessage[] {
  const total = messages.reduce((n, m) => n + m.content.length, 0);
  if (total <= budget) return messages;
  const kept: ChatMessage[] = [];
  let used = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    const len = messages[i]!.content.length;
    if (kept.length > 0 && used + len > budget) break;
    kept.unshift(messages[i]!);
    used += len;
  }
  return kept;
}

export interface UseChatStream {
  output: string; // the in-flight assistant reply
  streaming: boolean;
  error: string | null;
  remaining: number | null; // free messages left for THIS model (null until first call)
  pro: boolean;
  send: (modelSlug: string, messages: ChatMessage[]) => Promise<string>;
  reset: () => void;
  adopt: (sessionId: string) => void; // continue a saved session — new turns append to it
}

export function useChatStream(): UseChatStream {
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [pro, setPro] = useState(false);

  // persist the honcho/gateway session id across turns so history is saved server-side.
  const sessionId = useRef<string | null>(null);

  const send = useCallback(async (modelSlug: string, messages: ChatMessage[]): Promise<string> => {
    setStreaming(true);
    setError(null);
    setOutput("");
    let acc = "";

    // unique id per conversation so transcripts stay distinct (not merged under s_<model>).
    if (!sessionId.current) sessionId.current = crypto.randomUUID();

    // trim old turns to a char budget under the gateway's cap so long chats don't 413.
    // always keep the newest message; drop oldest first.
    const trimmed = trimToBudget(messages, INPUT_CHAR_BUDGET);

    try {
      const res = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader() },
        body: JSON.stringify({
          model: modelSlug,
          messages: trimmed,
          stream: true,
          sessionId: sessionId.current,
        }),
      });

      if (res.status === 402) {
        setRemaining(0);
        setError("free limit reached for this model — subscribe for unlimited or try another");
        return "";
      }
      if (res.status === 413) {
        setError("that message is too long for this model — shorten it and try again");
        return "";
      }
      if (!res.ok) throw new Error(`/v1/chat/completions → ${res.status}`);
      // reflect the server's per-model rate-limit verdict
      const tier = res.headers.get("x-hermetika-tier");
      const rem = res.headers.get("x-hermetika-free-remaining");
      setPro(tier === "pro");
      setRemaining(rem != null ? Number(rem) : null);
      const returned = res.headers.get("x-hermetika-session");
      if (returned) sessionId.current = returned;
      if (!res.body) throw new Error("no response body to stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const raw of lines) {
          const line = raw.trim();
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6);
          if (payload === "[DONE]") continue;
          try {
            const chunk = JSON.parse(payload) as StreamDelta;
            const token = chunk.choices?.[0]?.delta?.content;
            if (token) { acc += token; setOutput(acc); }
          } catch {
            // skip keep-alives / non-JSON frames
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
    return acc;
  }, []);

  const reset = useCallback(() => {
    setOutput("");
    setError(null);
    sessionId.current = null;
  }, []);

  const adopt = useCallback((id: string) => {
    setOutput("");
    setError(null);
    sessionId.current = id;
  }, []);

  return { output, streaming, error, remaining, pro, send, reset, adopt };
}
