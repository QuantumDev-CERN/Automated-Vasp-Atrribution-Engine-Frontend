"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PathHops } from "./PathHops";
import { Empty, Unavailable } from "@/components/state";
import { shortAddr, fmtDate, fmtNum } from "@/lib/format";
import type { GraphTopology, GraphNode, GraphPath, CaseLinks, InfraPivot } from "@/lib/api/graph";
import type { TraceJob } from "@/lib/api/jobs";

type Props = {
  caseId: string;
  subject: string;
  topology: GraphTopology | null;
  topoError: string | null;
  path: GraphPath | null;
  stats: (Record<string, number> & { case_id: string; backend: string }) | null;
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

const MAX_RENDER = 60;
const W = 900;
const H = 520;

type Placed = { node: GraphNode; x: number; y: number; kind: string };

/** Deterministic layered layout: BFS columns from the subject, rows spread. */
function layout(topology: GraphTopology, subject: string): { placed: Placed[]; edges: { x1: number; y1: number; x2: number; y2: number; label: string }[]; total: number } {
  const nodes = [...topology.nodes].sort((a, b) => b.degree - a.degree).slice(0, MAX_RENDER);
  const ids = new Set(nodes.map((n) => n.id));
  // make sure the subject is in view even if low-degree
  if (!ids.has(subject)) {
    const s = topology.nodes.find((n) => n.id === subject);
    if (s) { nodes[nodes.length - 1] = s; ids.delete(nodes[nodes.length - 1].id); ids.add(subject); }
  }
  const adj = new Map<string, string[]>();
  for (const e of topology.edges) {
    if (!ids.has(e.src) || !ids.has(e.dst)) continue;
    if (!adj.has(e.src)) adj.set(e.src, []);
    adj.get(e.src)!.push(e.dst);
    if (!adj.has(e.dst)) adj.set(e.dst, []);
    adj.get(e.dst)!.push(e.src);
  }
  const depth = new Map<string, number>();
  const start = ids.has(subject) ? subject : nodes[0]?.id;
  if (start) {
    depth.set(start, 0);
    const q = [start];
    while (q.length) {
      const cur = q.shift()!;
      for (const nb of adj.get(cur) ?? []) {
        if (!depth.has(nb)) { depth.set(nb, depth.get(cur)! + 1); q.push(nb); }
      }
    }
  }
  let extra = Math.max(0, ...[...depth.values(), 0]);
  for (const n of nodes) if (!depth.has(n.id)) depth.set(n.id, ++extra);
  const maxDepth = Math.max(1, ...depth.values());
  const layers = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const d = depth.get(n.id)!;
    if (!layers.has(d)) layers.set(d, []);
    layers.get(d)!.push(n);
  }
  const pos = new Map<string, { x: number; y: number }>();
  for (const [d, layer] of layers) {
    const x = 70 + (d / maxDepth) * (W - 140);
    layer.forEach((n, i) => {
      const y = layer.length === 1 ? H / 2 : 60 + (i / (layer.length - 1)) * (H - 120);
      pos.set(n.id, { x, y });
    });
  }
  const placed = nodes.map((node) => ({ node, ...pos.get(node.id)!, kind: nodeKind(node, subject) }));
  const edges: { x1: number; y1: number; x2: number; y2: number; label: string }[] = [];
  for (const e of topology.edges) {
    const a = pos.get(e.src); const b = pos.get(e.dst);
    if (!a || !b) continue;
    const label = e.value && e.value !== "0" ? `${e.value}${e.asset_symbol ? ` ${e.asset_symbol}` : ""}` : "";
    edges.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, label });
  }
  return { placed, edges: edges.slice(0, 200), total: topology.nodes.length };
}

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
    () => (props.topology ? layout(props.topology, props.subject) : null),
    [props.topology, props.subject]
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
              {props.topology?.truncated ? <span> · truncated to {MAX_RENDER} in view</span> : null}
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
                        <line x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="var(--edge)" strokeWidth={1.5} />
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
                    <span><span style={{ color: "var(--slate-400)" }}>○</span> address</span>
                    <span><span style={{ color: "var(--signal)" }}>●</span> mixer</span>
                    <span><span style={{ color: "var(--ink)" }}>◯</span> VASP</span>
                  </div>
                </>
              )}
              <div style={{ marginTop: 20 }}>
                <Unavailable endpoint="GET /cases/{case_id}/graph/activity" what="Transaction activity chart" />
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
                  <dl className="kv" style={{ gridTemplateColumns: "140px 1fr" }}>
                    {Object.entries(props.stats)
                      .filter(([k]) => k !== "case_id")
                      .map(([k, v]) => (
                        <div className="kv-row" key={k}>
                          <dt>{k.replace(/_/g, " ")}</dt>
                          <dd className="t-num">{typeof v === "number" ? fmtNum(v) : String(v)}</dd>
                        </div>
                      ))}
                  </dl>
                ) : (
                  <Empty title="Stats unavailable" hint="The stats endpoint did not respond." />
                )}
                <p style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 8 }}>
                  Classifier breakdowns (peel / sweep / mixer / bridge counts) need backend support — see docs/BACKEND-NEEDS.md.
                </p>
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
