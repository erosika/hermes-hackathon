import type { ReactNode } from "react";

// minimal markdown for model output — code fences + inline code/bold/italic.
// everything renders as React text nodes (no raw html), so untrusted output stays inert.

const INLINE = /(`[^`\n]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)/g;

function renderInline(text: string): ReactNode[] {
  const out: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (let m = INLINE.exec(text); m; m = INLINE.exec(text)) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    if (tok.startsWith("`")) out.push(<code key={k++} className="md-inline">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("**")) out.push(<strong key={k++}>{tok.slice(2, -2)}</strong>);
    else out.push(<em key={k++}>{tok.slice(1, -1)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

// an unclosed fence (mid-stream) renders as code too, so ascii art never flashes as prose.
const FENCE = /```[^\n]*\n?([\s\S]*?)(?:```|$)/g;

export function Markdown({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let k = 0;
  for (let m = FENCE.exec(text); m; m = FENCE.exec(text)) {
    if (m.index > last) parts.push(<span key={k++}>{renderInline(text.slice(last, m.index))}</span>);
    parts.push(<pre key={k++} className="md-code">{(m[1] ?? "").replace(/\n$/, "")}</pre>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(<span key={k++}>{renderInline(text.slice(last))}</span>);
  return <>{parts}</>;
}
