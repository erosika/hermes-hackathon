import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@hermetika/shared";
import { authHeader } from "./supabase";
import { API_BASE } from "./config";

interface StreamDelta {
  choices?: { delta?: { content?: string } }[];
}

export interface UseChatStream {
  output: string; // the in-flight assistant reply
  streaming: boolean;
  error: string | null;
  send: (modelSlug: string, messages: ChatMessage[]) => Promise<string>;
  reset: () => void;
}

export function useChatStream(): UseChatStream {
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // persist the honcho/gateway session id across turns so history is saved server-side.
  const sessionId = useRef<string | null>(null);

  const send = useCallback(async (modelSlug: string, messages: ChatMessage[]): Promise<string> => {
    setStreaming(true);
    setError(null);
    setOutput("");
    let acc = "";

    try {
      const res = await fetch(`${API_BASE}/v1/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", ...authHeader() },
        body: JSON.stringify({
          model: modelSlug,
          messages,
          stream: true,
          ...(sessionId.current ? { sessionId: sessionId.current } : {}),
        }),
      });

      if (!res.ok) throw new Error(`/v1/chat/completions → ${res.status}`);
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

  return { output, streaming, error, send, reset };
}
