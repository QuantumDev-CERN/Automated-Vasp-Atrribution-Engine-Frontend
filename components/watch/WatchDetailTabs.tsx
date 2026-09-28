"use client";

import { useState } from "react";
import { Empty, Unavailable } from "@/components/state";
import { shortAddr, fmtDate } from "@/lib/format";
import type { Watch, WatchAlert } from "@/lib/api/watchlist";

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

export function WatchDetailTabs({ initialTab, watch, alerts }: {
  initialTab: string;
  watch: Watch;
  alerts: WatchAlert[] | null;
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
            ["Case", watch.case_id ? <span className="mono">{watch.case_id}</span> : "—"],
            ["Alert URL", watch.alert_url ? <span className="mono">{watch.alert_url}</span> : "—"],
            ["Created by", watch.created_by || "—"],
            ["Created", fmtDate(watch.created_at)],
            ["Last checked", watch.last_checked_at ? fmtDate(watch.last_checked_at) : "—"],
          ]} />
          <div style={{ marginTop: 16 }}>
            <Unavailable endpoint="GET /watchlist/{watch_id}" what="Classification, cadence and lifetime hits" />
          </div>
        </div>
      )}

      {tab === "alerts" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Alerts</span>
            <span className="endpoint-chip">GET /watchlist/{`{watch_id}`}/alerts</span>
          </div>
          {alerts === null ? (
            <Empty title="Could not load alerts" hint="The watchlist API did not respond." />
          ) : alerts.length ? (
            <>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th><th>TX hash</th><th>Direction</th><th>Counterparty</th>
                    <th>Value</th><th>Asset</th><th>VASP hit</th><th>Delivered</th>
                  </tr>
                </thead>
                <tbody>
                  {alerts.map((a) => (
                    <tr key={a.alert_id}>
                      <td>{fmtDate(a.created_at)}</td>
                      <td className="mono" title={a.tx_hash}>{shortAddr(a.tx_hash)}</td>
                      <td style={{ textTransform: "capitalize" }}>{a.direction}</td>
                      <td className="mono" title={a.counterparty}>{shortAddr(a.counterparty)}</td>
                      <td className="t-num">{a.value}</td>
                      <td>{a.asset}</td>
                      <td>{a.vasp_hit ?? "—"}</td>
                      <td>{a.delivered ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 8 }}>
                Signal, points, severity and analyst disposition need backend fields — see docs/BACKEND-NEEDS.md.
              </p>
            </>
          ) : (
            <Empty title="No alerts yet" hint="Alerts appear here when the watched address moves." />
          )}
        </div>
      )}

      {tab === "checks" && (
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Check history</span>
          </div>
          <Unavailable endpoint="GET /watchlist/{watch_id}/checks" what="Check history" />
        </div>
      )}
    </div>
  );
}
