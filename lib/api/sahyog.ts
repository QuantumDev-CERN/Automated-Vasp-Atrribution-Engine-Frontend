import { sahyog } from "./server";

/**
 * SAHYOG mock (port 8091): webhook deliveries, watch alerts, case submissions.
 * Powers the filings register's transmission sections. The mock stores
 * deliveries in memory; when it is unreachable the sections render an
 * honest unavailable state instead of invented rows.
 */
export type WebhookDelivery = {
  received_at: string;
  payload: Record<string, unknown>;
};

export type WatchAlertReceipt = {
  received_at: string;
  payload: Record<string, unknown>;
};

export function listWebhookDeliveries() {
  return sahyog.get<{ count: number; webhooks: WebhookDelivery[] }>("/sahyog/webhooks");
}

export function listWatchAlertReceipts() {
  return sahyog.get<{ count: number; alerts: WatchAlertReceipt[] }>("/sahyog/watch-alerts");
}

export function getSahyogCase(caseId: string) {
  return sahyog.get<Record<string, unknown>>(`/sahyog/cases/${caseId}`);
}
