import Link from "next/link";
import { Chrome } from "@/components/chrome/Chrome";
import { Empty, PageError } from "@/components/state";
import { listFilings } from "@/lib/api/filings";
import { listWebhookDeliveries, listWatchAlertReceipts } from "@/lib/api/sahyog";
import { ApiError } from "@/lib/api/server";
import { shortAddr, fmtDate } from "@/lib/format";

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

const PAGE_SIZE = 20;
const STATUS_TABS = ["delivered", "failed"] as const;

export default async function FilingsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const qs = await searchParams;
  const status = (qs.status ?? "").trim() || undefined;
  const page = Math.max(1, Number(qs.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [filingsR, webhooksR, alertsR] = await Promise.allSettled([
    listFilings({ status, limit: PAGE_SIZE, offset }),
    listWebhookDeliveries(),
    listWatchAlertReceipts(),
  ]);

  if (filingsR.status === "rejected") {
    return (
      <Chrome crumb="Filings / Register">
        <PageError title="Could not load filings register" error={filingsR.reason} />
      </Chrome>
    );
  }
  const list = filingsR.value;
  const webhooks = webhooksR.status === "fulfilled" ? webhooksR.value : null;
  const webhooksError = webhooksR.status === "rejected" ? webhooksR.reason : null;
  const alerts = alertsR.status === "fulfilled" ? alertsR.value : null;

  const mockDown = (e: unknown) => e instanceof ApiError && e.status === 0;
  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const tabHref = (s?: string) => `/filings${s ? `?status=${s}` : ""}`;
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    sp.set("page", String(p));
    return `/filings?${sp}`;
  };

  return (
    <Chrome crumb="Filings / Register">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Filings register</h1>
            <p className="page-sub">
              {list.total} filing{list.total === 1 ? "" : "s"} recorded by the engine
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">:8091 POST /sahyog/cases</span>
            <Link href="/filings/new" className="btn-primary">New filing</Link>
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span className="section-label">Register</span>
        <span className="endpoint-chip">GET /filings</span>
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <Link href={tabHref()} className={"tab" + (!status ? " active" : "")}>All</Link>
        {STATUS_TABS.map((s) => (
          <Link key={s} href={tabHref(s)} className={"tab" + (status === s ? " active" : "")}
            style={{ textTransform: "capitalize" }}>
            {s}
          </Link>
        ))}
      </div>

      <div style={{ marginBottom: 32 }}>
        {list.filings.length ? (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filing</th><th>FIR number</th><th>Subject</th><th>Channel</th>
                  <th>Status</th><th>Attempts</th><th>Filed</th>
                  <th className="cell-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {list.filings.map((f) => (
                  <tr key={f.filing_id}>
                    <td className="t-ink mono" title={f.filing_id}>{f.filing_id.slice(0, 8)}</td>
                    <td className="t-ink mono">{f.fir_number ?? "—"}</td>
                    <td className="mono" title={f.suspect_address ?? ""}>
                      {f.suspect_address ? shortAddr(f.suspect_address) : "—"}
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>{f.channel}</td>
                    <td style={{ textTransform: "capitalize" }}>{f.status}</td>
                    <td className="t-num">{f.attempts}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(f.filed_at)}</td>
                    <td className="cell-end">
                      <Link href={`/filings/${f.filing_id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, fontSize: 12, color: "var(--tertiary)" }}>
              <span>Page {page} of {totalPages} · {list.total} total</span>
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                {page > 1 ? <Link href={pageHref(page - 1)} className="btn-secondary">← Prev</Link> : null}
                {page < totalPages ? <Link href={pageHref(page + 1)} className="btn-secondary">Next →</Link> : null}
              </span>
            </div>
          </>
        ) : (
          <Empty
            title={status ? "No filings with this status" : "No filings recorded yet"}
            hint="A filing is recorded each time an attribution package is delivered to SAHYOG."
          />
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span className="section-label">Mock receiver log (session-local)</span>
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
