// backend registry — one place that knows every upstream + its character.
// gpu lanes: spark (vLLM hot, fast+concurrent) · sparktail (Ollama breadth, paged)
//            brev (paid vLLM burst) · modal (fallback)
// proxy:     nvidia · nous · openrouter

export type Runtime = "vllm" | "ollama" | "proxy";

export interface Backend {
  baseUrl: string | undefined; // OpenAI-compatible /v1 root
  runtime: Runtime;
  paid: boolean; // paid → feeds survival-loop spend; owned → free
  apiKey?: string;
  failover?: string; // provider to route to if this one is down
}

const env = process.env;

export const BACKENDS: Record<string, Backend> = {
  // owned DGX Spark, two lanes over Tailscale
  spark: { baseUrl: env.SPARK_VLLM_URL, runtime: "vllm", paid: false, failover: "brev" },
  sparktail: { baseUrl: env.SPARK_OLLAMA_URL, runtime: "ollama", paid: false, failover: "brev" },

  // paid GPU
  brev: { baseUrl: env.BREV_BASE_URL, runtime: "vllm", paid: true, apiKey: env.BREV_API_KEY },
  modal: { baseUrl: env.MODAL_BASE_URL, runtime: "vllm", paid: true, apiKey: env.MODAL_API_KEY },

  // proxied
  nvidia: { baseUrl: "https://integrate.api.nvidia.com/v1", runtime: "proxy", paid: true, apiKey: env.NVIDIA_API_KEY },
  nous: { baseUrl: "https://inference-api.nousresearch.com/v1", runtime: "proxy", paid: true, apiKey: env.NOUS_API_KEY },
  openrouter: { baseUrl: "https://openrouter.ai/api/v1", runtime: "proxy", paid: true, apiKey: env.OPENROUTER_API_KEY },
};

export function getBackend(provider: string): Backend | undefined {
  return BACKENDS[provider];
}
