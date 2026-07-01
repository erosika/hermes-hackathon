import { useCallback, useRef, useState } from "react";
import type { ChatMessage } from "@hermetika/shared";
import { authHeader } from "./supabase";

interface StreamDelta {
  choices?: { delta?: { content?: string } }[];
}

export interface UseChatStream {
  output: string;
  streaming: boolean;
  error: string | null;
  send: (modelSlug: string, prompt: string) => Promise<void>;
  reset: () => void;
}

export function useChatStream(): UseChatStream {
  const [output, setOutput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // persist honcho session across turns so continuity survives re-renders.
  const sessionId = useRef<string | null>(null);

  const send = useCallback(async (modelSlug: string, prompt: string) => {
    setStreaming(true);
    setError(null);
    setOutput("");

    const messages: ChatMessage[] = [{ role: "user", content: prompt }];

    try {
      const res = await fetch("/v1/chat/completions", {
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

        // hold back the trailing fragment; it may be a partial line across reads.
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
            if (token) setOutput((prev) => prev + token);
          } catch {
            // skip keep-alives / non-JSON frames rather than aborting the stream.
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
    }
  }, []);

  const reset = useCallback(() => {
    setOutput("");
    setError(null);
  }, []);

  return { output, streaming, error, send, reset };
}
