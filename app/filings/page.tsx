import Link from "next/link";
import { Chrome } from "@/components/chrome/Chrome";
import { Empty, Unavailable } from "@/components/state";
import { listWebhookDeliveries, listWatchAlertReceipts } from "@/lib/api/sahyog";
import { ApiError } from "@/lib/api/server";
import { fmtDate } from "@/lib/format";

/** One-line summary of a webhook payload: first few scalar fields, honestly. */
function payloadSummary(payload: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(payload)) {
    if (parts.length >= 3) break;
    if (v === null || typeof v === "object") continue;
    parts.push(`${k}: ${String(v).slice(0, 40)}`);
  }
  return parts.join(" · ") || "(empty payload)";
}

export default async function FilingsPage() {
  const [webhooksR, alertsR] = await Promise.allSettled([
    listWebhookDeliveries(),
    listWatchAlertReceipts(),
  ]);
  const webhooks = webhooksR.status === "fulfilled" ? webhooksR.value : null;
  const webhooksError = webhooksR.status === "rejected" ? webhooksR.reason : null;
  const alerts = alertsR.status === "fulfilled" ? alertsR.value : null;

  const mockDown = (e: unknown) => e instanceof ApiError && e.status === 0;

  return (
    <Chrome crumb="Filings / Register">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Filings register</h1>
            <p className="page-sub">SAHYOG mock on :8091</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">:8091 POST /sahyog/cases</span>
            <Link href="/filings/new" className="btn-primary">New filing</Link>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span className="section-label">Register</span>
      </div>
      <div style={{ marginBottom: 32 }}>
        <Unavailable endpoint="GET /filings" what="Filings register" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Webhook deliveries</span>
            <span className="endpoint-chip">:8091 GET /sahyog/webhooks</span>
          </div>
          {webhooks ? (
            webhooks.webhooks.length ? (
              <table className="data-table">
                <thead><tr><th>Received</th><th>Payload</th></tr></thead>
                <tbody>
                  {webhooks.webhooks.map((w, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(w.received_at)}</td>
                      <td className="mono" style={{ fontSize: 11 }} title={JSON.stringify(w.payload)}>
                        {payloadSummary(w.payload)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="No webhook deliveries yet" hint="The engine POSTs attribution results here as traces resolve." />
            )
          ) : (
            <Empty
              title="SAHYOG mock unreachable"
              hint={mockDown(webhooksError) ? "Start the mock on :8091 to see deliveries." : "Could not read webhook deliveries."}
            />
          )}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Watch alerts received</span>
            <span className="endpoint-chip">:8091 GET /sahyog/watch-alerts</span>
          </div>
          {alerts ? (
            alerts.alerts.length ? (
              <table className="data-table">
                <thead><tr><th>Received</th><th>Payload</th></tr></thead>
                <tbody>
                  {alerts.alerts.map((a, i) => (
                    <tr key={i}>
                      <td style={{ whiteSpace: "nowrap" }}>{fmtDate(a.received_at)}</td>
                      <td className="mono" style={{ fontSize: 11 }} title={JSON.stringify(a.payload)}>
                        {payloadSummary(a.payload)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="No watch alerts received yet" hint="Movement alerts from watched addresses land here." />
            )
          ) : (
            <Empty title="SAHYOG mock unreachable" hint="Start the mock on :8091 to see received alerts." />
          )}
        </div>
      </div>
    </Chrome>
  );
}
