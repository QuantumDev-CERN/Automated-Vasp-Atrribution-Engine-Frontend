"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Empty } from "@/components/state";
import { shortAddr, fmtDate } from "@/lib/format";
import type { Watch } from "@/lib/api/watchlist";

function uuid8(id: string) {
  return id.length > 8 ? id.slice(0, 8) : id;
}

export function WatchTable({ watches, checkNow }: {
  watches: Watch[];
  checkNow: (formData: FormData) => void;
}) {
  const [filter, setFilter] = useState<"all" | "active" | "paused">("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return watches.filter((w) => {
      if (filter !== "all" && w.status !== filter) return false;
      if (needle && !(w.watch_id.toLowerCase().includes(needle) || w.label.toLowerCase().includes(needle) || w.address.toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [watches, filter, q]);
  const active = watches.filter((w) => w.status === "active").length;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div className="tabs" style={{ borderBottom: 0 }}>
          {(["all", "active", "paused"] as const).map((f) => (
            <button key={f} className={"tab" + (filter === f ? " active" : "")} onClick={() => setFilter(f)}>
              {f[0].toUpperCase() + f.slice(1)} {f === "all" ? watches.length : f === "active" ? active : watches.length - active}
            </button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span className="endpoint-chip">GET /watchlist</span>
          <input className="search-input" placeholder="Search watch id or target" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      {rows.length ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Watch</th><th>Target</th><th>Address</th><th>Chain</th><th>Status</th><th>Last check</th><th className="cell-end">24h alerts</th><th className="cell-end">Checks</th><th className="cell-end">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w) => (
              <tr key={w.watch_id}>
                <td className="t-ink mono"><Link href={`/watch/${w.watch_id}`}>{uuid8(w.watch_id)}</Link></td>
                <td className="t-ink"><Link href={`/watch/${w.watch_id}`}>{w.label || "—"}</Link></td>
                <td className="mono" title={w.address}>{shortAddr(w.address)}</td>
                <td style={{ textTransform: "capitalize" }}>{w.chain}</td>
                <td style={{ color: w.status === "active" ? "var(--ok-text)" : "var(--tertiary)" }}>
                  {w.status === "active" ? "Active" : "Paused"}
                </td>
                <td>{w.last_checked_at ? fmtDate(w.last_checked_at) : "—"}</td>
                <td className="cell-end">{w.alerts_24h ?? "—"}</td>
                <td className="cell-end">{w.lifetime_checks ?? "—"}</td>
                <td className="cell-end">
                  <form action={checkNow} style={{ display: "inline" }}>
                    <input type="hidden" name="watch_id" value={w.watch_id} />
                    <button type="submit" style={{ background: "none", border: 0, color: "var(--ink)", fontSize: 12, cursor: "pointer", padding: 0 }}>
                      Check now
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty title={watches.length ? "No watches match" : "No watches yet"} hint={watches.length ? "Adjust the filter or search." : "Add a watch to monitor an address for new movements."} />
      )}
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12 }}>
        <span style={{ fontSize: 12, color: "var(--tertiary)" }}>Showing {rows.length} of {watches.length} watches</span>
      </div>
    </div>
  );
}
