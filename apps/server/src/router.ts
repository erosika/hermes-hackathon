import type { Model, ChatRequest, BackendRef } from "@hermetika/shared";
import { getBackend, type Backend } from "./backends";
import { isHealthy } from "./health";

// per-model backend resolution + dispatch. one OpenAI-compatible surface in,
// the right upstream out. hermetika owns failover: spark down → brev twin.

export function parseRef(ref: BackendRef): { provider: string; id: string } {
  const [, rest] = ref.split("://") as [string, string];
  const [provider, ...idParts] = rest.split("/");
  return { provider: provider!, id: idParts.join("/") };
}

export interface Resolved {
  provider: string;
  backend: Backend;
  upstreamModel: string;
  failedOver: boolean;
}

export function resolve(model: Model): Resolved {
  const { provider, id } = parseRef(model.backendRef);
  const backend = getBackend(provider);
  if (!backend) throw new Error(`no backend configured for provider '${provider}'`);

  // failover: if the primary is unhealthy and it declares a failover, swing to it.
  if (!isHealthy(provider) && backend.failover) {
    const fb = getBackend(backend.failover);
    if (fb?.baseUrl) {
      return { provider: backend.failover, backend: fb, upstreamModel: id, failedOver: true };
    }
  }
  return { provider, backend, upstreamModel: id, failedOver: false };
}

export async function dispatch(model: Model, req: ChatRequest): Promise<{ res: Response; resolved: Resolved }> {
  const resolved = resolve(model);
  const { backend, upstreamModel } = resolved;
  if (!backend.baseUrl) throw new Error(`backend '${resolved.provider}' has no baseUrl`);

  // inject the model's persona as a system message unless the client already set one.
  const hasSystem = req.messages.some((m) => m.role === "system");
  const messages = model.persona && !hasSystem
    ? [{ role: "system" as const, content: model.persona }, ...req.messages]
    : req.messages;

  const res = await fetch(`${backend.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(backend.apiKey ? { authorization: `Bearer ${backend.apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: upstreamModel,
      messages,
      stream: req.stream ?? false,
      stream_options: req.stream ? { include_usage: true } : undefined,
      max_tokens: req.maxTokens, // gateway-clamped output ceiling
      stop: ["<|im_end|>", "<|im_start|>", "<|eot_id|>"], // some GGUFs leak template tokens
    }),
  });
  return { res, resolved };
}
