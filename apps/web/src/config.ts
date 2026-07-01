// API base for gateway calls. empty in dev (Vite proxies /api + /v1 to :3001);
// set VITE_API_BASE=https://api.hermetika.io in prod so the static SPA reaches the gateway.
export const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";
