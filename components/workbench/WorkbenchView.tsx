"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PathHops } from "./PathHops";
import { Empty } from "@/components/state";
import { shortAddr, fmtDate, fmtNum } from "@/lib/format";
import type { GraphTopology, GraphNode, GraphPath, GraphStats, CaseLinks, InfraPivot } from "@/lib/api/graph";
import type { TraceJob } from "@/lib/api/jobs";

type Props = {
  caseId: string;
  subject: string;
  topology: GraphTopology | null;
  topoError: string | null;
  path: GraphPath | null;
  stats: GraphStats | null;
  links: CaseLinks | null;
  infra: InfraPivot | null;
  infraTag: string | null;
  job: TraceJob | null;
  jobId: string | null;
  traceError?: string;
  runTrace: (formData: FormData) => void;
};

function nodeKind(n: GraphNode, subject: string): string {
  if (n.id === subject) return "Subject";
  const all = [...n.labels, ...(n.tags ?? [])].join(" ").toLowerCase();
  if (all.includes("mixer")) return "Mixer";
  if (all.includes("vasp")) return "VASP";
  if (all.includes("coinjoin")) return "CoinJoin";
  if (all.includes("peel")) return "Peel";
  if (all.includes("sweep")) return "Sweep";
  if (all.includes("bridge")) return "Bridge";
  if (all.includes("swap")) return "Swap";
  return "Address";
}

/** Max nodes on the path-first canvas (path hops + bounded context). */

/** Denominated edge label: "1.80 ETH". Prefers the backend's
 * value_denominated (coin units); falls back to raw value only when the
 * backend predates it. Never prints base units next to a coin symbol. */
function edgeLabel(e: { value?: string | null; value_denominated?: string | null; asset_symbol?: string | null }): string {
  const raw = e.value_denominated ?? e.value;
  if (!raw || raw === "0") return "";
  const n = Number(raw);
  const body = Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : raw;
  return e.asset_symbol ? `${body} ${e.asset_symbol}` : body;
}

/** Path-first layout (per FRONTEND-SPEC §4.3): the attribution path is the
 * canvas. Path hops are laid left-to-right by hop index; a bounded set of
 * high-degree neighbours adds context. No degree-ranked hairball. */
function layout(
  topology: GraphTopology,
  subject: string,
  path: GraphPath | null
): { placed: Placed[]; edges: { x1: number; y1: number; x2: number; y2: number; label: string; probabilistic: boolean; pathEdge: boolean }[]; total: number } {
  const nodeById = new Map(topology.nodes.map((n) => [n.id, n]));
  const pathAddrs = (path?.hops ?? []).map((h) => h.address).filter((a) => nodeById.has(a));
  // Fallback when no path: subject + terminal + top-degree neighbours.
  const ordered: GraphNode[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    const n = nodeById.get(id);
    if (n && !seen.has(id)) { seen.add(id); ordered.push(n); }
  };
  for (const a of pathAddrs) push(a);
  push(subject);
  if (ordered.length === 0) {
    for (const n of [...topology.nodes].sort((a, b) => b.degree - a.degree).slice(0, 12)) push(n.id);
  }
  // Bounded context: up to 2 highest-degree neighbours per path node.
  const adj = new Map<string, string[]>();
  for (const e of topology.edges) {
    if (!nodeById.has(e.src) || !nodeById.has(e.dst)) continue;
    if (!adj.has(e.src)) adj.set(e.src, []);
    adj.get(e.src)!.push(e.dst);
  }
  const pathSet = new Set(ordered.map((n) => n.id));
  for (const n of [...ordered]) {
    if (ordered.length >= 14) break;
    const nbs = (adj.get(n.id) ?? [])
      .filter((id) => !pathSet.has(id) && !seen.has(id))
      .map((id) => nodeById.get(id)!)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 2);
    for (const nb of nbs) { push(nb.id); pathSet.add(nb.id); }
  }
  const ids = new Set(ordered.map((n) => n.id));
  const hopIndex = new Map(pathAddrs.map((a, i) => [a, i]));
  const nPath = Math.max(1, pathAddrs.length);
  const pos = new Map<string, { x: number; y: number; pathEdge: boolean }>();
  // Path nodes: spread across the canvas by hop index, alternating slight
  // vertical offsets so labels don't collide (mirrors the SVG).
  pathAddrs.forEach((a, i) => {
    const x = 90 + (nPath === 1 ? 0.5 : i / (nPath - 1)) * (W - 180);
    const y = H / 2 + (i % 2 === 0 ? -70 : 70) * (nPath > 3 ? 1 : 0);
    pos.set(a, { x, y, pathEdge: true });
  });
  // Context nodes: tuck near their path neighbour.
  let ctxSlot = 0;
  for (const n of ordered) {
    if (pos.has(n.id)) continue;
    const anchor = pathAddrs[ctxSlot % Math.max(1, pathAddrs.length)] ?? n.id;
    const base = pos.get(anchor) ?? { x: W / 2, y: H / 2 };
    const k = Math.floor(ctxSlot / Math.max(1, pathAddrs.length));
    pos.set(n.id, {
      x: Math.min(W - 60, Math.max(60, base.x + (k % 2 === 0 ? -1 : 1) * 90)),
      y: Math.min(H - 60, Math.max(60, base.y + (k < 2 ? 110 : -110))),
      pathEdge: false,
    });
    ctxSlot++;
  }
  // Ensure every ordered node got a position.
  for (const n of ordered) {
    if (!pos.has(n.id)) pos.set(n.id, { x: W / 2, y: H / 2, pathEdge: false });
  }
  const placed = ordered.map((node) => ({ node, x: pos.get(node.id)!.x, y: pos.get(node.id)!.y, kind: nodeKind(node, subject) }));
  const kindById = new Map(placed.map((p) => [p.node.id, p.kind]));
  const pathPairs = new Set<string>();
  for (let i = 0; i + 1 < pathAddrs.length; i++) pathPairs.add(`${pathAddrs[i]}>${pathAddrs[i + 1]}`);
  const edges: { x1: number; y1: number; x2: number; y2: number; label: string; probabilistic: boolean; pathEdge: boolean }[] = [];
  for (const e of topology.edges) {
    const a = pos.get(e.src); const b = pos.get(e.dst);
    if (!a || !b) continue;
    const isPath = pathPairs.has(`${e.src}>${e.dst}`);
    const probabilistic = kindById.get(e.src) === "Mixer" && kindById.get(e.dst) === "VASP";
    edges.push({
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      label: isPath ? edgeLabel(e) : "",
      probabilistic,
      pathEdge: isPath,
    });
    if (edges.length >= 200) break;
  }
  return { placed, edges, total: topology.total_addresses };
}

/** Tiny bar chart for per-day transfer counts — data from the engine,
 * nothing fabricated. */
function ActivityBars({ days }: { days: { date: string; transactions: number; transfers: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.transfers));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 72 }}>
      {days.map((d) => (
        <div
          key={d.date}
          title={`${d.date} — ${d.transactions} transactions, ${d.transfers} transfers`}
          style={{
            flex: 1, minWidth: 0,
            height: `${Math.max(3, Math.round((d.transfers / max) * 72))}px`,
            background: "var(--primary)",
            opacity: d.transfers ? 1 : 0.25,
          }}
        />
      ))}
    </div>
  );
}
const W = 900;
const H = 520;

type Placed = { node: GraphNode; x: number; y: number; kind: string };

const TERMINAL = ["complete", "failed"];

export function WorkbenchView(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"graph" | "path">("graph");
  const [selected, setSelected] = useState<string | null>(null);
  const [liveJob, setLiveJob] = useState<TraceJob | null>(props.job);

  // Poll the trace job while it runs; refresh the canvas when it lands.
  useEffect(() => {
    if (!props.jobId || !liveJob || TERMINAL.includes(liveJob.status)) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/jobs/${props.jobId}`);
        if (!res.ok) return;
        const j: TraceJob = await res.json();
        setLiveJob(j);
        if (TERMINAL.includes(j.status)) { clearInterval(t); router.refresh(); }
      } catch { /* keep polling */ }
    }, 3000);
    return () => clearInterval(t);
  }, [props.jobId, liveJob, router]);

  const graph = useMemo(
    () => (props.topology ? layout(props.topology, props.subject, props.path) : null),
    [props.topology, props.subject, props.path]
  );
  const selectedNode = useMemo(
    () => graph?.placed.find((p) => p.node.id === selected)?.node ?? null,
    [graph, selected]
  );

  const jobLine = liveJob
    ? `${liveJob.job_id.slice(0, 8)} · ${liveJob.status}`
    : props.topology
      ? `${fmtNum(props.topology.total_addresses)} nodes · ${fmtNum(props.topology.total_transfers)} edges`
      : "no graph yet";

  return (
    <div>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">{props.caseId} — Trace workbench</h1>
            <p className="page-sub">
              {jobLine}
              {liveJob?.error ? <span style={{ color: "var(--signal)" }}> · {liveJob.error}</span> : null}
              {props.topology?.truncated ? <span> · path in view, {fmtNum(props.topology.total_addresses)} total</span> : null}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">POST /jobs/trace</span>
            <form action={props.runTrace}>
              <input type="hidden" name="case_id" value={props.caseId} />
              <button type="submit" className="btn-primary">Run trace</button>
            </form>
          </div>
        </div>
        {props.traceError ? <p style={{ fontSize: 12, color: "var(--signal)" }}>Trace failed to start ({props.traceError}).</p> : null}
      </div>

      <div className="tabs" style={{ marginBottom: 16 }}>
        <button className={"tab" + (tab === "graph" ? " active" : "")} onClick={() => setTab("graph")}>Graph</button>
        <button className={"tab" + (tab === "path" ? " active" : "")} onClick={() => setTab("path")}>Path &amp; hops</button>
      </div>

      {tab === "graph" && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="endpoint-chip">GET /cases/{`{case_id}`}/graph</span>
            {graph ? <span style={{ fontSize: 12, color: "var(--tertiary)" }}>{graph.placed.length} of {fmtNum(graph.total)} nodes in view</span> : null}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
            <div>
              {props.topoError || !graph ? (
                <Empty
                  title="No graph available"
                  hint={props.topoError ? `The topology endpoint failed: ${props.topoError}` : "Run a trace to build the transaction graph for this case."}
                />
              ) : (
                <>
                  <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--hairline)", borderRadius: 6 }} role="img" aria-label="Transaction graph">
                    {graph.edges.map((e, i) => (
                      <g key={i}>
                        <line
                          x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                          stroke={e.probabilistic ? "var(--signal)" : e.pathEdge ? "var(--ink)" : "var(--hairline)"}
                          strokeWidth={e.pathEdge ? 2 : 1.2}
                          strokeDasharray={e.probabilistic ? "6 4" : undefined}
                        />
                        {e.label ? (
                          <text x={(e.x1 + e.x2) / 2} y={(e.y1 + e.y2) / 2 - 6} textAnchor="middle" fontSize={10} fill="var(--tertiary)">{e.label}</text>
                        ) : null}
                      </g>
                    ))}
                    {graph.placed.map((p) => {
                      const isSel = selected === p.node.id;
                      const fill = p.kind === "Subject" ? "var(--ink)" : p.kind === "Mixer" ? "var(--signal)" : p.kind === "VASP" ? "var(--panel)" : "var(--panel)";
                      const stroke = p.kind === "VASP" ? "var(--ink)" : p.kind === "Mixer" ? "var(--signal)" : "var(--slate-400)";
                      return (
                        <g key={p.node.id} onClick={() => setSelected(p.node.id)} style={{ cursor: "pointer" }}>
                          {isSel ? <circle cx={p.x} cy={p.y} r={13} fill="none" stroke="var(--primary)" strokeWidth={2} /> : null}
                          <circle cx={p.x} cy={p.y} r={p.kind === "Subject" || p.kind === "VASP" ? 7 : 6} fill={fill} stroke={stroke} strokeWidth={p.kind === "VASP" ? 2 : 1.7} />
                          <text x={p.x} y={p.y - 14} textAnchor="middle" fontSize={10} fill="var(--tertiary)">{p.kind}</text>
                          <text x={p.x} y={p.y + 24} textAnchor="middle" fontSize={10.5} fill="var(--ink)" fontFamily="var(--font-mono)">{shortAddr(p.node.id)}</text>
                        </g>
                      );
                    })}
                  </svg>
                  <div style={{ display: "flex", gap: 16, marginTop: 10, fontSize: 11, color: "var(--tertiary)" }}>
                    <span><span style={{ color: "var(--ink)" }}>●</span> subject</span>
                    <span><span style={{ color: "var(--slate-400)" }}>○</span> peel</span>
                    <span><span style={{ color: "var(--slate-400)" }}>○</span> sweep</span>
                    <span><span style={{ color: "var(--signal)" }}>●</span> mixer</span>
                    <span><span style={{ color: "var(--ink)" }}>◯</span> VASP</span>
                    <span><span style={{ color: "var(--signal)" }}>┄</span> probabilistic</span>
                  </div>
                </>
              )}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span className="section-label">Transaction activity · last 30 days</span>
                  <span className="endpoint-chip">GET /cases/{`{case_id}`}/graph/stats</span>
                </div>
                {(props.stats?.daily_activity ?? []).length ? (
                  <ActivityBars days={props.stats!.daily_activity} />
                ) : (
                  <Empty title="No activity data" hint="Daily counts appear once the traced graph has timestamped edges." />
                )}
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span className="section-label">Selected node</span>
                </div>
                {selectedNode ? (
                  <dl className="kv" style={{ gridTemplateColumns: "110px 1fr" }}>
                    <div className="kv-row"><dt>Address</dt><dd className="mono" style={{ wordBreak: "break-all" }}>{selectedNode.id}</dd></div>
                    <div className="kv-row"><dt>Kind</dt><dd>{nodeKind(selectedNode, props.subject)}</dd></div>
                    <div className="kv-row"><dt>Labels</dt><dd>{selectedNode.labels.length ? selectedNode.labels.join(", ") : "—"}</dd></div>
                    <div className="kv-row"><dt>Tags</dt><dd>{selectedNode.tags?.length ? selectedNode.tags.join(", ") : "—"}</dd></div>
                    <div className="kv-row"><dt>Chains</dt><dd>{selectedNode.chains.join(", ") || "—"}</dd></div>
                    <div className="kv-row"><dt>Degree</dt><dd>{selectedNode.degree}</dd></div>
                    <div className="kv-row"><dt>First seen</dt><dd>{selectedNode.first_seen ? fmtDate(selectedNode.first_seen) : "—"}</dd></div>
                  </dl>
                ) : (
                  <Empty title="No node selected" hint="Click a node on the canvas to inspect it." />
                )}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span className="section-label">Graph stats</span>
                  <span className="endpoint-chip">GET /cases/{`{case_id}`}/graph/stats</span>
                </div>
                {props.stats ? (
                  <>
                    <dl className="kv" style={{ gridTemplateColumns: "140px 1fr" }}>
                      {Object.entries(props.stats)
                        .filter(([k, v]) => k !== "case_id" && typeof v !== "object")
                        .map(([k, v]) => (
                          <div className="kv-row" key={k}>
                            <dt>{k.replace(/_/g, " ")}</dt>
                            <dd className="t-num">{typeof v === "number" ? fmtNum(v) : String(v)}</dd>
                          </div>
                        ))}
                    </dl>
                    {Object.keys(props.stats.classifier_breakdown ?? {}).length ? (
                      <>
                        <div className="section-label" style={{ margin: "16px 0 8px" }}>Classifier breakdown</div>
                        <dl className="kv" style={{ gridTemplateColumns: "140px 1fr" }}>
                          {Object.entries(props.stats.classifier_breakdown).map(([k, v]) => (
                            <div className="kv-row" key={k}>
                              <dt style={{ textTransform: "capitalize" }}>{k.replace(/-/g, " ")}</dt>
                              <dd className="t-num">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    ) : null}
                    {(props.stats.daily_activity ?? []).length ? (
                      <>
                        <div className="section-label" style={{ margin: "16px 0 8px" }}>Daily activity · last 30 days</div>
                        <ActivityBars days={props.stats.daily_activity} />
                      </>
                    ) : null}
                  </>
                ) : (
                  <Empty title="Stats unavailable" hint="The stats endpoint did not respond." />
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {tab === "path" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 24 }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="section-label">Attribution path</span>
              <span className="endpoint-chip">GET /cases/{`{case_id}`}/graph/path</span>
            </div>
            {props.path ? (
              <>
                <p style={{ fontSize: 12, color: "var(--tertiary)", margin: "0 0 16px" }}>
                  Subject {shortAddr(props.path.subject)} → terminal {shortAddr(props.path.terminal)} · {props.path.hops.length} hops
                </p>
                <PathHops hops={props.path.hops} />
              </>
            ) : (
              <Empty title="No traced path yet" hint="Run a trace to compute the subject → terminal trail." />
            )}
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="section-label">Cross-case links</span>
              <span className="endpoint-chip">GET /cases/{`{case_id}`}/links</span>
            </div>
            {props.links && props.links.links.length ? (
              <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                {props.links.links.map((l) => (
                  <li key={l.case_id} style={{ padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                    <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{l.case_id}</div>
                    <div style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 4 }}>
                      {l.overlap} shared address{l.overlap === 1 ? "" : "es"}
                      {l.shared_tags.length ? ` · ${l.shared_tags.join(", ")}` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <Empty title="No cross-case links" />
            )}
            {props.infraTag ? (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span className="section-label">Shared infrastructure</span>
                </div>
                {props.infra ? (
                  <p style={{ fontSize: 12, color: "var(--body)" }}>
                    <span className="mono">{props.infra.tag}</span> · {props.infra.address_count} addresses
                  </p>
                ) : (
                  <Empty title="Pivot returned nothing" />
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
