"use client";

import { useState } from "react";
import { Empty } from "@/components/state";
import { shortAddr, fmtDate } from "@/lib/format";
import type { WatchDetail, WatchCheck, WatchAlert, Disposition } from "@/lib/api/watchlist";
import { VALID_DISPOSITIONS } from "@/lib/api/watchlist";

const TABS = ["overview", "alerts", "checks"] as const;
type Tab = (typeof TABS)[number];

function Kv({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div className="kv-row" key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function dispositionLabel(d: string | null) {
  return d ? d.replace(/_/g, " ") : "—";
}

function AlertRow({ alert, watchId, disposeAlert }: {
  alert: WatchAlert;
  watchId: string;
  disposeAlert: (formData: FormData) => void;
}) {
  return (
    <tr>
      <td>{fmtDate(alert.created_at)}</td>
      <td className="mono" title={alert.tx_hash}>{shortAddr(alert.tx_hash)}</td>
      <td style={{ textTransform: "capitalize" }}>{alert.direction}</td>
      <td className="mono" title={alert.counterparty}>{shortAddr(alert.counterparty)}</td>
      <td className="t-num">{alert.value}</td>
      <td>{alert.asset}</td>
      <td>{alert.vasp_hit ?? "—"}</td>
      <td>{alert.delivered ? "Yes" : "No"}</td>
      <td>
        {alert.disposition ? (
          <div style={{ fontSize: 12 }}>
            <span style={{ textTransform: "capitalize", fontWeight: 500 }}>
              {dispositionLabel(alert.disposition)}
            </span>
            {alert.disposition_by ? (
              <div style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 2 }}>
                by {alert.disposition_by}
                {alert.disposition_at ? ` · ${fmtDate(alert.disposition_at)}` : ""}
              </div>
            ) : null}
            {alert.disposition_notes ? (
              <div style={{ fontSize: 11, color: "var(--body)", marginTop: 2 }}>
                {alert.disposition_notes}
              </div>
            ) : null}
          </div>
        ) : (
          <form action={disposeAlert} style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <input type="hidden" name="watch_id" value={watchId} />
            <input type="hidden" name="alert_id" value={alert.alert_id} />
            <select name="disposition" className="search-input" style={{ width: 150 }} required defaultValue="">
              <option value="" disabled>Set…</option>
              {VALID_DISPOSITIONS.map((d: Disposition) => (
                <option key={d} value={d}>{dispositionLabel(d)}</option>
              ))}
            </select>
            <input name="notes" className="search-input" placeholder="Note (optional)" style={{ width: 170 }} />
            <button type="submit" className="btn-secondary">Save</button>
          </form>
        )}
      </td>
    </tr>
  );
}

export function WatchDetailTabs({ initialTab, watch, checks, disposeAlert }: {
  initialTab: string;
  watch: WatchDetail;
  checks: WatchCheck[] | null;
  disposeAlert: (formData: FormData) => void;
}) {
  const [tab, setTab] = useState<Tab>(TABS.includes(initialTab as Tab) ? (initialTab as Tab) : "overview");

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Target profile</span>
            <span className="endpoint-chip">GET /watchlist/{`{watch_id}`}</span>
          </div>
          <Kv rows={[
            ["Label", watch.label || "—"],
            ["Chain", <span style={{ textTransform: "capitalize" }}>{watch.chain}</span>],
            ["Target", <span className="mono">{watch.address}</span>],
            ["Status", <span style={{ textTransform: "capitalize" }}>{watch.status}</span>],
            ["Classification", <span style={{ textTransform: "capitalize" }}>{watch.classification || "—"}</span>],
            ["Case", watch.case_id ? <span className="mono">{watch.case_id}</span> : "—"],
            ["Alert URL", watch.alert_url ? <span className="mono">{watch.alert_url}</span> : "—"],
            ["Created by", watch.created_by || "—"],
            ["Created", fmtDate(watch.created_at)],
            ["Last checked", watch.last_checked_at ? fmtDate(watch.last_checked_at) : "—"],
          ]} />
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="section-label">Watch lifetime</span>
              <span className="endpoint-chip">GET /watchlist/{`{watch_id}`}</span>
            </div>
            <Kv rows={[
              ["Check cadence", `${watch.cadence_minutes} min`],
              ["Lifetime checks", String(watch.lifetime_checks)],
              ["Lifetime alerts", String(watch.lifetime_alerts)],
              ["Alerts (24h)", String(watch.alerts_24h)],
            ]} />
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Alerts</span>
            <span className="endpoint-chip">GET /watchlist/{`{watch_id}`}</span>
          </div>
          {watch.alerts.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Time</th><th>TX hash</th><th>Direction</th><th>Counterparty</th>
                  <th>Value</th><th>Asset</th><th>VASP hit</th><th>Delivered</th><th>Disposition</th>
                </tr>
              </thead>
              <tbody>
                {watch.alerts.map((a) => (
                  <AlertRow key={a.alert_id} alert={a} watchId={watch.watch_id} disposeAlert={disposeAlert} />
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No alerts yet" hint="Alerts appear here when the watched address moves." />
          )}
        </div>
      )}

      {tab === "checks" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Check history</span>
            <span className="endpoint-chip">GET /watchlist/{`{watch_id}`}/checks</span>
          </div>
          {checks === null ? (
            <Empty title="Could not load check history" hint="The watchlist API did not respond." />
          ) : checks.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Checked at</th><th>TXs seen</th><th>New events</th>
                  <th>Alerts delivered</th><th>Baseline</th><th>Error</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.check_id}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(c.checked_at)}</td>
                    <td className="t-num">{c.txs_seen}</td>
                    <td className="t-num">{c.new_events}</td>
                    <td className="t-num">{c.alerts_delivered}</td>
                    <td>{c.baseline ? "Yes" : "No"}</td>
                    <td style={{ fontSize: 11, color: "var(--signal)", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}
                      title={c.error ?? ""}>
                      {c.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No checks recorded yet" hint="Each poll cycle is recorded here, including baselines and failures." />
          )}
        </div>
      )}
    </div>
  );
}
