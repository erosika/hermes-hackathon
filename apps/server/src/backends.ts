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
  // vLLM serving DiffusionGemma NVFP4 on spark-1 (its own port + Caddy route). no failover twin — single instance.
  sparkdiff: { baseUrl: env.SPARKDIFF_URL, runtime: "vllm", paid: false, apiKey: env.SPARKDIFF_TOKEN },
  // SGLang serving Inkling-Small NVFP4 dual-node TP=2 across both Sparks (/inkling Caddy route on spark-1).
  // mutually exclusive with the ollama lanes — spark-mode flips between them.
  sparkink: { baseUrl: env.SPARKINK_URL, runtime: "vllm", paid: false, apiKey: env.SPARKINK_TOKEN ?? env.SPARK_TOKEN },
};

export function getBackend(provider: string): Backend | undefined {
  return BACKENDS[provider];
}
