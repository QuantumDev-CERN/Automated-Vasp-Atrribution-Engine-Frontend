import { vasp } from "./server";

/** GET /health — liveness probe shown in the status bar. */
export type Health = { status: string; service: string };

/** GET /ready — dependency checks: what the store, queue and graph actually are. */
export type Ready = {
  status: "ok" | "degraded";
  checks: { store: string; queue: string; graph: string };
};

export function getHealth() {
  return vasp.get<Health>("/health");
}

export function getReady() {
  return vasp.get<Ready>("/ready");
}
