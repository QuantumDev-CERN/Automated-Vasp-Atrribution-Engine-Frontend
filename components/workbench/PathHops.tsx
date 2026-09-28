"use client";

import { shortAddr, pct } from "@/lib/format";
import type { PathHop } from "@/lib/api/graph";

/**
 * Vertical attribution-path timeline: kind label, address, classifier
 * reason, per-hop confidence. Rendered from GET /cases/{case_id}/graph/path.
 */
export function PathHops({ hops }: { hops: PathHop[] }) {
  if (!hops.length) return <p style={{ color: "var(--tertiary)", fontSize: 12 }}>No hops returned for this case.</p>;
  return (
    <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
      {hops.map((h, i) => {
        const first = i === 0;
        const kind = (h.kind ?? "hop").toLowerCase();
        const dotColor = kind.includes("mixer") ? "var(--signal)" : "var(--ink)";
        return (
          <li key={i} style={{ display: "flex", gap: 16, position: "relative", paddingBottom: i === hops.length - 1 ? 0 : 28 }}>
            {!first && (
              <span style={{ position: "absolute", left: 5, top: -28, bottom: 8, width: 2, background: "var(--hairline)" }} />
            )}
            <span
              style={{
                width: 12, height: 12, borderRadius: "50%", flexShrink: 0, marginTop: 2,
                background: first ? "var(--panel)" : dotColor,
                border: `2px solid ${first ? "var(--slate-400)" : dotColor}`,
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="section-label" style={{ marginBottom: 4 }}>{h.kind ?? `Hop ${h.hop}`}</div>
              <div className="mono" style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }} title={h.address}>
                {shortAddr(h.address)}
              </div>
              {h.reason ? <div style={{ fontSize: 12, color: "var(--body)", marginTop: 4 }}>{h.reason}</div> : null}
              <div style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 4, display: "flex", gap: 12 }}>
                {h.via_tx ? <span className="mono" title={h.via_tx}>via {shortAddr(h.via_tx)}</span> : null}
                {h.value ? <span>{h.value} {h.asset_symbol ?? ""}</span> : null}
                {h.block_time ? <span>{h.block_time.slice(0, 10)}</span> : null}
              </div>
            </div>
            <div style={{ fontSize: 12, color: "var(--body)", fontVariantNumeric: "tabular-nums", flexShrink: 0 }}>
              {pct(h.confidence)}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
