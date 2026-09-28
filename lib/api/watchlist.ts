import { vasp } from "./server";

/** Watchlist subscription — /watchlist (M10, enriched M26). */
export type Watch = {
  watch_id: string;
  address: string;
  chain: string;
  label: string;
  case_id: string | null;
  alert_url: string;
  created_by: string;
  status: "active" | "paused";
  classification: string;
  last_checked_at: string | null;
  created_at: string;
  /** Present on GET /watchlist rows (M26); absent on older backends. */
  alerts_24h?: number;
  lifetime_checks?: number;
  lifetime_alerts?: number;
};

/** One poll cycle of a watch — GET /watchlist/{watch_id}/checks (M26). */
export type WatchCheck = {
  check_id: string;
  checked_at: string;
  txs_seen: number;
  new_events: number;
  alerts_delivered: number;
  baseline: boolean;
  error: string | null;
};

/** Enriched watch detail — GET /watchlist/{watch_id} (M26). */
export type WatchDetail = Watch & {
  cadence_minutes: number;
  lifetime_checks: number;
  lifetime_alerts: number;
  alerts_24h: number;
  check_history: WatchCheck[];
  alerts: WatchAlert[];
};

export type WatchAlert = {
  alert_id: string;
  tx_hash: string;
  direction: string;
  counterparty: string;
  value: string;
  asset: string;
  vasp_hit: string | null;
  delivered: boolean;
  disposition: string | null;
  disposition_notes: string | null;
  disposition_by: string | null;
  disposition_at: string | null;
  created_at: string;
};

export type WatchSubmit = {
  address: string;
  chain: string;
  label?: string;
  case_id?: string | null;
  alert_url?: string;
  created_by?: string;
};

export const VALID_DISPOSITIONS = ["true_positive", "false_positive", "benign", "escalated"] as const;
export type Disposition = (typeof VALID_DISPOSITIONS)[number];

export function listWatches(activeOnly = false) {
  return vasp.get<{ watches: Watch[] }>(`/watchlist?active_only=${activeOnly}`);
}

export function getWatch(watchId: string) {
  return vasp.get<WatchDetail>(`/watchlist/${watchId}`);
}

export function addWatch(payload: WatchSubmit) {
  return vasp.post<{ watch_id: string; status: string }>("/watchlist", payload);
}

export function setWatchStatus(watchId: string, status: "active" | "paused") {
  return vasp.patch<{ watch_id: string; status: string }>(`/watchlist/${watchId}`, { status });
}

export function removeWatch(watchId: string) {
  return vasp.del<{ watch_id: string; removed: boolean }>(`/watchlist/${watchId}`);
}

export function listAlerts(watchId: string) {
  return vasp.get<{ watch_id: string; alerts: WatchAlert[] }>(`/watchlist/${watchId}/alerts`);
}

export function listChecks(watchId: string, limit = 50) {
  return vasp.get<{ watch_id: string; checks: WatchCheck[] }>(
    `/watchlist/${watchId}/checks?limit=${limit}`
  );
}

export function setAlertDisposition(watchId: string, alertId: string, payload: { disposition: Disposition; notes?: string }) {
  return vasp.patch<{ alert_id: string; watch_id: string; disposition: string }>(
    `/watchlist/${watchId}/alerts/${alertId}`,
    payload
  );
}

export function checkWatchNow(watchId: string) {
  return vasp.post<{ watch_id: string } & Record<string, unknown>>(`/watchlist/${watchId}/check`);
}
