"use client";

import { useMemo, useState } from "react";
import { Empty } from "@/components/state";
import { fmtDate } from "@/lib/format";
import type { AuditEvent } from "@/lib/api/admin";

const PAGE = 16;

function humanize(action: string): string {
  return action.replace(/[._]/g, " ");
}

export function AuditTable({ events }: { events: AuditEvent[] }) {
  const [filter, setFilter] = useState<"all" | "allow" | "deny">("all");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(0);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return events.filter((e) => {
      if (filter !== "all" && (e.outcome ?? "").toLowerCase() !== filter) return false;
      if (needle) {
        const hay = `${e.action} ${e.user_name ?? ""} ${e.target_id ?? ""} ${e.target_type ?? ""}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [events, filter, q]);
  const allows = events.filter((e) => (e.outcome ?? "").toLowerCase() === "allow").length;
  const denies = events.filter((e) => (e.outcome ?? "").toLowerCase() === "deny").length;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const pageRows = rows.slice(page * PAGE, page * PAGE + PAGE);
  const reset = () => setPage(0);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="tabs" style={{ borderBottom: 0 }}>
          {(["all", "allow", "deny"] as const).map((f) => (
            <button
              key={f}
              className={"tab" + (filter === f ? " active" : "")}
              onClick={() => { setFilter(f); reset(); }}
            >
              {f === "all" ? `All ${events.length}` : f === "allow" ? `Allows ${allows}` : `Denies ${denies}`}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="endpoint-chip">GET /admin/audit</span>
          <input className="search-input" placeholder="Search events" value={q} onChange={(e) => { setQ(e.target.value); reset(); }} />
        </div>
      </div>
      {pageRows.length ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Event</th><th>Actor</th><th>Action</th><th>Target</th><th>Result</th><th>Time</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((e) => (
              <tr key={e.event_id}>
                <td className="mono">{e.action}</td>
                <td className="t-ink">{e.user_name ?? (e.user_id ? e.user_id.slice(0, 8) : "—")}</td>
                <td className="t-ink">{humanize(e.action)}</td>
                <td className="mono" title={e.target_id ?? ""}>
                  {e.target_id ? (e.target_id.length > 24 ? e.target_id.slice(0, 24) + "…" : e.target_id) : e.target_type ?? "—"}
                </td>
                <td style={{ color: (e.outcome ?? "").toLowerCase() === "deny" ? "var(--signal)" : "var(--ok-text)" }}>
                  {e.outcome ?? "—"}
                </td>
                <td>{fmtDate(e.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty title={events.length ? "No events match" : "No audit events"} hint={events.length ? "Adjust the filter or search." : "Audit events appear here as the engine is used."} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
        <span style={{ fontSize: 12, color: "var(--tertiary)" }}>
          Showing {pageRows.length} of {rows.length} events
        </span>
        {pages > 1 ? (
          <div style={{ display: "flex", gap: 8 }}>
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                style={{
                  background: "none", border: 0, cursor: "pointer", fontSize: 12,
                  color: i === page ? "var(--ink)" : "var(--tertiary)",
                  fontWeight: i === page ? 600 : 400, padding: "2px 6px",
                }}
              >
                {i + 1}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
