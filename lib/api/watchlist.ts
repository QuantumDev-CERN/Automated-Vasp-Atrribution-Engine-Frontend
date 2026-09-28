import { vasp } from "./server";

/** Watchlist subscription — /watchlist (M10). */
export type Watch = {
  watch_id: string;
  address: string;
  chain: string;
  label: string;
  case_id: string | null;
  alert_url: string;
  created_by: string;
  status: "active" | "paused";
  last_checked_at: string | null;
  created_at: string;
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

export function listWatches(activeOnly = false) {
  return vasp.get<{ watches: Watch[] }>(`/watchlist?active_only=${activeOnly}`);
}

export function getWatch(watchId: string) {
  return vasp.get<Watch>(`/watchlist/${watchId}`);
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

export function checkWatchNow(watchId: string) {
  return vasp.post<{ watch_id: string } & Record<string, unknown>>(`/watchlist/${watchId}/check`);
}
