import type { Model, ChatRequest, BackendRef } from "@hermetika/shared";

// per-model backend resolution. one OpenAI-compatible surface in, the right
// upstream out. gpu:// → Brev/Modal web endpoint; proxy:// → forward with env key.

interface Resolved {
  baseUrl: string;
  apiKey: string;
  upstreamModel: string;
}

function parseRef(ref: BackendRef): { scheme: string; provider: string; id: string } {
  const [scheme, rest] = ref.split("://") as [string, string];
  const [provider, ...idParts] = rest.split("/");
  return { scheme, provider: provider!, id: idParts.join("/") };
}

const PROVIDER_BASE: Record<string, string | undefined> = {
  nvidia: "https://integrate.api.nvidia.com/v1",
  nous: "https://inference-api.nousresearch.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  brev: process.env.BREV_BASE_URL,
  modal: process.env.MODAL_BASE_URL,
};

const PROVIDER_KEY: Record<string, string | undefined> = {
  nvidia: process.env.NVIDIA_API_KEY,
  nous: process.env.NOUS_API_KEY,
  openrouter: process.env.OPENROUTER_API_KEY,
  brev: process.env.BREV_API_KEY,
  modal: process.env.MODAL_API_KEY,
};

export function resolve(model: Model): Resolved {
  const { provider, id } = parseRef(model.backendRef);
  const baseUrl = PROVIDER_BASE[provider];
  if (!baseUrl) throw new Error(`no base url configured for provider '${provider}'`);
  return { baseUrl, apiKey: PROVIDER_KEY[provider] ?? "", upstreamModel: id };
}

// forward an OpenAI-compatible request to the resolved upstream, stream SSE back unchanged.
export async function dispatch(model: Model, req: ChatRequest): Promise<Response> {
  const { baseUrl, apiKey, upstreamModel } = resolve(model);
  const upstream = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
    },
    body: JSON.stringify({
      model: upstreamModel,
      messages: req.messages,
      stream: req.stream ?? false,
    }),
  });
  return upstream;
}
