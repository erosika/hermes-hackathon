// API base for gateway calls. dev: empty so Vite proxies /api + /v1 to :3001.
// prod: fall back to the Fly gateway until api.hermetika.io DNS is live (then drop the fallback).
const raw = (import.meta.env.VITE_API_BASE as string | undefined)?.trim();
const GATEWAY = "https://hermetika-gateway.fly.dev";
export const API_BASE = import.meta.env.DEV
  ? (raw ?? "")
  : !raw || raw.includes("api.hermetika.io")
    ? GATEWAY
    : raw;
