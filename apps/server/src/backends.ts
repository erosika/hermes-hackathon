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

// two owned DGX Sparks, each behind a bearer-auth Caddy over Tailscale. failover twins.
export const BACKENDS: Record<string, Backend> = {
  spark: { baseUrl: env.SPARK_URL, runtime: "ollama", paid: false, apiKey: env.SPARK_TOKEN, failover: "sparktail" },
  sparktail: { baseUrl: env.SPARKTAIL_URL, runtime: "ollama", paid: false, apiKey: env.SPARKTAIL_TOKEN, failover: "spark" },
};

export function getBackend(provider: string): Backend | undefined {
  return BACKENDS[provider];
}
