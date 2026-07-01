import type { LedgerEntry, Model, Profile, Subscription } from "@hermetika/shared";
import { authHeader } from "./supabase";
import { API_BASE } from "./config";

// thin client over the gateway's REST surface. auth is the Supabase JWT (Bearer).

export interface RevenueView {
  mrr: number;
  active: number;
  total: number;
  recent: Subscription[];
  incomeTotal: number;
  entries: LedgerEntry[];
}

export interface SubscribeLink {
  url: string;
  plan: string;
  priceUsd: number;
  live: boolean;
}

export interface Me {
  email: string | null;
  subscribed: boolean;
  authConfigured?: boolean;
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { headers: authHeader() });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

async function postJson<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: authHeader() });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export const getMe = () => getJson<Me>("/api/auth/me");
export const subscribeDemo = () => postJson<{ ok: boolean; subscribed: boolean }>("/api/subscribe/demo");

export const getModels = () => getJson<Model[]>("/api/models");
export const getModel = (slug: string) => getJson<Model>(`/api/models/${slug}`);
export const getProfiles = () => getJson<Profile[]>("/api/profiles");
export const getBackends = () => getJson<unknown>("/api/backends");
export const getRevenue = () => getJson<RevenueView>("/api/revenue");
export const getSubscriptions = () => getJson<Subscription[]>("/api/subscriptions");
export const getSubscribe = () => getJson<SubscribeLink>("/api/subscribe");
export const getPortal = () => getJson<{ url: string }>("/api/portal");

// derive the serving lane from a model's backend_ref for honest labels.
export function laneLabel(backendRef: string): string {
  const provider = backendRef.split("://")[1]?.split("/")[0] ?? "";
  switch (provider) {
    case "spark":
      return "◆ owned · spark hot";
    case "sparktail":
      return "◆ owned · spark tail";
    case "brev":
      return "◇ paid · brev burst";
    case "modal":
      return "◇ paid · modal";
    default:
      return `proxy · ${provider}`;
  }
}
