"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PathHops } from "./PathHops";
import { Empty } from "@/components/state";
import { shortAddr, fmtDate, fmtNum } from "@/lib/format";
import type { GraphTopology, GraphNode, GraphPath, PathHop, GraphStats, GraphTransactions, GraphTransaction, CaseLinks, InfraPivot } from "@/lib/api/graph";
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

/** Display label for a selected node's kind — hop classification first
 * (SVG §4: "Mixer deposit"), tag fallback for off-path context nodes. */
function selectedKind(n: GraphNode, hop: PathHop | null | undefined, subject: string): string {
  if (n.id === subject) return "Subject";
  const map: Record<string, string> = {
    "mixer-deposit": "Mixer deposit",
    "peel": "Peel",
    "sweep": "Sweep",
    "direct": "Direct transfer",
    "vasp-deposit": "VASP deposit",
    "bridge": "Bridge",
    "swap": "Swap",
    "coinjoin": "CoinJoin",
  };
  if (hop?.kind && map[hop.kind]) return map[hop.kind];
  return nodeKind(n, subject);
}

/** Honest structural assessment of a selected node — derived only from the
 * persisted path/topology, never invented. */
function nodeAssessment(n: GraphNode, hop: PathHop | null | undefined, path: GraphPath | null, subject: string): string {
  const isTerminal = path != null && n.id === path.terminal;
  if (n.id === subject) return "Trace origin — the wallet under investigation.";
  if (isTerminal) {
    if (hop?.kind === "mixer-deposit")
      return "Terminal: probabilistic lead only, no deterministic onward trail.";
    if (hop?.kind === "vasp-deposit")
      return "Terminal attribution: the traced funds reached this VASP.";
    return "Terminal node of the traced path.";
  }
  if (hop && path) return `Hop ${hop.hop} of ${path.hops.length - 1} on the subject → terminal path.`;
  return "Context node — adjacent to, but not on, the attribution path.";
}
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

/** Edge geometry for the canvas: endpoints, label, styling flags, plus the
 * shortened line end and filled polygon arrowhead (path + probabilistic). */
type EdgeGeom = {
  x1: number; y1: number; x2: number; y2: number;
  src: string; dst: string;
  label: string; probabilistic: boolean; pathEdge: boolean;
  /** Line end (shortened for the arrowhead) + filled polygon arrowhead. */
  lx: number; ly: number; head: string | null;
};

/** Arrowhead polygon for an edge, tip just outside the target node's ring. */
function arrowhead(x1: number, y1: number, x2: number, y2: number, nodeR: number): { line: [number, number]; head: string } {
  const dx = x2 - x1; const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len; const uy = dy / len;
  const tipX = x2 - ux * (nodeR + 2); const tipY = y2 - uy * (nodeR + 2);
  const baseX = tipX - ux * 9; const baseY = tipY - uy * 9;
  const px = -uy * 4.2; const py = ux * 4.2;
  return {
    line: [baseX, baseY],
    head: `${tipX},${tipY} ${baseX + px},${baseY + py} ${baseX - px},${baseY - py}`,
  };
}

/** Path-first layout (per FRONTEND-SPEC §4.3): the attribution path is the
 * canvas. Path hops are laid left-to-right by hop index; a bounded set of
 * high-degree neighbours adds context. No degree-ranked hairball. */
function layout(
  topology: GraphTopology,
  subject: string,
  path: GraphPath | null
): { placed: Placed[]; edges: EdgeGeom[]; total: number } {
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
  // Neighbours are undirected: an address that FUNDS a path node (incoming
  // edge) is context too, not just onward (outgoing) neighbours.
  const adj = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.get(a)!.includes(b)) adj.get(a)!.push(b);
  };
  for (const e of topology.edges) {
    if (!nodeById.has(e.src) || !nodeById.has(e.dst)) continue;
    link(e.src, e.dst);
    link(e.dst, e.src);
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
      x: Math.min(W - 60, Math.max(110, base.x + (k % 2 === 0 ? -1 : 1) * 90)),
      y: Math.min(H - 60, Math.max(60, base.y + (k < 2 ? 110 : -110))),
      pathEdge: false,
    });
    ctxSlot++;
  }
  // Ensure every ordered node got a position.
  for (const n of ordered) {
    if (!pos.has(n.id)) pos.set(n.id, { x: W / 2, y: H / 2, pathEdge: false });
  }
  const placed = ordered.map((node) => ({ node, x: pos.get(node.id)!.x, y: pos.get(node.id)!.y, kind: nodeKind(node, subject), labDir: "down" as Placed["labDir"] }));
  const kindById = new Map(placed.map((p) => [p.node.id, p.kind]));
  const pathPairs = new Set<string>();
  for (let i = 0; i + 1 < pathAddrs.length; i++) pathPairs.add(`${pathAddrs[i]}>${pathAddrs[i + 1]}`);
  const edges: EdgeGeom[] = [];
  for (const e of topology.edges) {
    const a = pos.get(e.src); const b = pos.get(e.dst);
    if (!a || !b) continue;
    const isPath = pathPairs.has(`${e.src}>${e.dst}`);
    const probabilistic = kindById.get(e.src) === "Mixer" && kindById.get(e.dst) === "VASP";
    // Filled polygon arrowheads on path + probabilistic edges (spec §4.3).
    // Target node radius matches the render loop below (7 for subject/VASP).
    let lx = b.x; let ly = b.y; let head: string | null = null;
    if (isPath || probabilistic) {
      const dstKind = kindById.get(e.dst);
      const r = dstKind === "Subject" || dstKind === "VASP" ? 7 : 6;
      const ah = arrowhead(a.x, a.y, b.x, b.y, r);
      lx = ah.line[0]; ly = ah.line[1]; head = ah.head;
    }
    edges.push({
      x1: a.x, y1: a.y, x2: b.x, y2: b.y,
      src: e.src, dst: e.dst,
      lx, ly, head,
      label: isPath ? edgeLabel(e) : "",
      probabilistic,
      pathEdge: isPath,
    });
    if (edges.length >= 200) break;
  }
  // Label direction: put the kind+address block in the largest angular gap
  // between incident edges, snapped to a cardinal (generalizes the SVG's
  // hand-tuned label offsets, so edges never strike through labels).
  const TWO_PI = Math.PI * 2;
  for (const p of placed) {
    const angs: number[] = [];
    for (const e of edges) {
      if (e.src === p.node.id) angs.push(Math.atan2(e.y2 - e.y1, e.x2 - e.x1));
      else if (e.dst === p.node.id) angs.push(Math.atan2(e.y1 - e.y2, e.x1 - e.x2));
    }
    if (!angs.length) { p.labDir = "down"; continue; }
    angs.sort((a, b) => a - b);
    let bestMid = angs[0]; let bestGap = -1;
    for (let i = 0; i < angs.length; i++) {
      const a = angs[i];
      const b = angs[(i + 1) % angs.length] + (i + 1 === angs.length ? TWO_PI : 0);
      if (b - a > bestGap) { bestGap = b - a; bestMid = (a + b) / 2; }
    }
    const c = Math.cos(bestMid); const s = Math.sin(bestMid);
    p.labDir = Math.abs(s) > Math.abs(c) ? (s < 0 ? "up" : "down") : (c < 0 ? "left" : "right");
  }
  return { placed, edges, total: topology.total_addresses };
}

/** One icon button in the floating canvas-controls pill (spec §3.6). */
function PillBtn({ title, onClick, active, children }: {
  title: string; onClick: () => void; active: boolean; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 28, height: 28, display: "grid", placeItems: "center",
        border: "none", borderRadius: 999, cursor: "pointer",
        background: active ? "var(--wash)" : "transparent",
        color: active ? "var(--ink)" : "var(--tertiary)",
      }}
    >
      <svg width={16} height={16} viewBox="0 0 24 24" stroke="currentColor">{children}</svg>
    </button>
  );
}

/** Tiny bar chart for per-day transfer counts — data from the engine,
 * nothing fabricated. */
/** Recent transactions, in words (M39): the newest transfers as cards,
 * newest first, with pagination — replaces the bar chart. */
const TX_PAGE = 4;
function RecentTransactions({ caseId }: { caseId: string }) {
  const [data, setData] = useState<GraphTransactions | null>(null);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const load = async (off: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/v1/cases/${caseId}/graph/transactions?limit=${TX_PAGE}&offset=${off}`);
      if (res.ok) { setData(await res.json()); setOffset(off); }
    } catch { /* keep current page */ } finally { setLoading(false); }
  };
  useEffect(() => { setData(null); setOffset(0); load(0); }, [caseId]);
  const total = data?.total ?? 0;
  const items = data?.items ?? [];
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + TX_PAGE, total);
  const kindLabel = (k: string | null) =>
    k ? k.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ") : null;
  return (
    <div>
      {items.map((t, i) => {
        const kl = kindLabel(t.kind);
        return (
          <div key={`${t.tx_hash ?? "notx"}-${t.src}-${t.dst}-${i}`} style={{ border: "1px solid var(--hairline)", borderRadius: 8, padding: "10px 12px", marginBottom: 8, background: "#fff" }}>
            <div className="mono" style={{ fontSize: 12 }} title={`${t.src} → ${t.dst}`}>
              {shortAddr(t.src)} <span style={{ color: "var(--tertiary)" }}>→</span> {shortAddr(t.dst)}
            </div>
            <div style={{ fontSize: 12, color: "var(--body)", marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="t-num">{t.value ?? "—"}{t.asset_symbol ? ` ${t.asset_symbol}` : ""}</span>
              <span style={{ color: "var(--tertiary)" }}>·</span>
              <span>{fmtDate(t.block_time)}</span>
              {kl ? (
                <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--wash)", color: "var(--body)" }}>
                  {kl}{t.confidence != null ? ` · ${t.confidence.toFixed(2)}` : ""}
                </span>
              ) : null}
            </div>
            {t.reason ? (
              <div style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 4 }}>{t.reason}</div>
            ) : null}
          </div>
        );
      })}
      {!loading && items.length === 0 ? (
        <Empty title="No transactions" hint="Transfers appear once the traced graph has timestamped edges." />
      ) : null}
      {total > 0 ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 12, color: "var(--tertiary)" }} className="t-num">
            Showing {from}–{to} of {fmtNum(total)}
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => load(offset - TX_PAGE)}
              disabled={loading || offset === 0}
              style={{ fontSize: 12, padding: "4px 10px", border: "1px solid var(--hairline)", borderRadius: 6, background: "#fff", cursor: offset === 0 ? "default" : "pointer", opacity: offset === 0 ? 0.4 : 1 }}
            >‹ Prev</button>
            <button
              onClick={() => load(offset + TX_PAGE)}
              disabled={loading || offset + TX_PAGE >= total}
              style={{ fontSize: 12, padding: "4px 10px", border: "1px solid var(--hairline)", borderRadius: 6, background: "#fff", cursor: offset + TX_PAGE >= total ? "default" : "pointer", opacity: offset + TX_PAGE >= total ? 0.4 : 1 }}
            >Next ›</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
const W = 900;
const H = 520;

type Placed = { node: GraphNode; x: number; y: number; kind: string; labDir: "up" | "down" | "left" | "right" };

const TERMINAL = ["complete", "failed"];

export function WorkbenchView(props: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"graph" | "path">("graph");
  const [selected, setSelected] = useState<string | null>(null);
  const [liveJob, setLiveJob] = useState<TraceJob | null>(props.job);
  // Canvas view: pan/zoom + display toggles (controls pill, spec §3.6).
  const [view, setView] = useState({ x: 0, y: 0, z: 1 });
  const [showLabels, setShowLabels] = useState(true);
  const [showContext, setShowContext] = useState(true);
  const [panning, setPanning] = useState<{ sx: number; sy: number; vx: number; vy: number; z: number } | null>(null);
  // Live-refetchable canvas data (M37): edge-count filter.
  const [topology, setTopology] = useState(props.topology);
  const [stats] = useState(props.stats);
  const [edgeCount, setEdgeCount] = useState(2000);
  const [filterOpen, setFilterOpen] = useState(false);
  const [loadingTopo, setLoadingTopo] = useState(false);

  const changeEdgeCount = async (n: number) => {
    setEdgeCount(n); setFilterOpen(false);
    if (n === edgeCount) return;
    setLoadingTopo(true);
    try {
      const res = await fetch(`/api/v1/cases/${props.caseId}/graph?max_edges=${n}`);
      if (res.ok) setTopology(await res.json());
    } catch { /* keep current topology */ } finally { setLoadingTopo(false); }
  };

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
    () => (topology ? layout(topology, props.subject, props.path) : null),
    [topology, props.subject, props.path]
  );
  const selectedNode = useMemo(
    () => graph?.placed.find((p) => p.node.id === selected)?.node ?? null,
    [graph, selected]
  );
  const selectedHop = useMemo(
    () => props.path?.hops.find((h) => h.address === selected) ?? null,
    [props.path, selected]
  );
  // Visible canvas subset: hiding context keeps the path; layout is stable.
  const pathIds = useMemo(
    () => new Set((props.path?.hops ?? []).map((h) => h.address)),
    [props.path]
  );
  const visible = useMemo(() => {
    if (!graph) return null;
    if (showContext) return graph;
    const keep = new Set(graph.placed.filter((p) => pathIds.has(p.node.id)).map((p) => p.node.id));
    return {
      ...graph,
      placed: graph.placed.filter((p) => keep.has(p.node.id)),
      edges: graph.edges.filter((e) => keep.has(e.src) && keep.has(e.dst)),
    };
  }, [graph, showContext, pathIds]);
  const [showGrid, setShowGrid] = useState(true);

  // Graph-stats rows for the selected-node panel (SVG §4): Nodes / Edges
  // from persisted stats + the classifier breakdown, in SVG order.
  const statRows = useMemo<[string, number][]>(() => {
    const rows: [string, number][] = [];
    if (!stats) return rows;
    const num = (v: unknown): number | null =>
      typeof v === "number" && Number.isFinite(v) ? v : null;
    const a = num((stats as Record<string, unknown>).addresses);
    const t = num((stats as Record<string, unknown>).transfers);
    if (a != null) rows.push(["Nodes", a]);
    if (t != null) rows.push(["Edges", t]);
    const bd = (stats.classifier_breakdown ?? {}) as Record<string, unknown>;
    for (const [k, label] of [["peel", "Peel"], ["sweep", "Sweep"], ["mixer-deposit", "Mixer"], ["bridge", "Bridge"]] as const) {
      const v = num(bd[k]);
      if (v != null) rows.push([label, v]);
    }
    return rows;
  }, [stats]);

  const zoomBy = (f: number) =>
    setView((v) => ({ ...v, z: Math.min(4, Math.max(0.5, v.z * f)) }));
  const resetView = () => { setView({ x: 0, y: 0, z: 1 }); setSelected(null); };
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Wheel-zoom around the cursor; drag the background to pan.
  // viewBox = (view.x, view.y, W/view.z, H/view.z).
  const onWheel = (e: React.WheelEvent) => {
    const svg = svgRef.current; if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const f = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    setView((v) => {
      const z = Math.min(4, Math.max(0.5, v.z * f));
      const k = z / v.z;
      const vx = v.x + ((e.clientX - rect.left) / rect.width) * (W / v.z);
      const vy = v.y + ((e.clientY - rect.top) / rect.height) * (H / v.z);
      return { z, x: vx - (vx - v.x) / k, y: vy - (vy - v.y) / k };
    });
  };
  const onMouseDown = (e: React.MouseEvent) => {
    // Only pan from the background, not from a node.
    if ((e.target as Element).closest?.("[data-node]")) return;
    setPanning({ sx: e.clientX, sy: e.clientY, vx: view.x, vy: view.y, z: view.z });
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!panning || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const kx = (W / panning.z) / rect.width; const ky = (H / panning.z) / rect.height;
    setView((v) => ({ ...v, x: panning.vx - (e.clientX - panning.sx) * kx, y: panning.vy - (e.clientY - panning.sy) * ky }));
  };
  const endPan = () => setPanning(null);
  const vbW = W / view.z; const vbH = H / view.z;

  const jobLine = liveJob
    ? `${liveJob.job_id.slice(0, 8)} · ${liveJob.status}`
    : topology
      ? `${fmtNum(topology.total_addresses)} nodes · ${fmtNum(topology.total_transfers)} edges`
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
              {topology?.truncated ? <span> · path in view, {fmtNum(topology.total_addresses)} total</span> : null}
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
            {visible ? <span style={{ fontSize: 12, color: "var(--tertiary)" }}>{visible.placed.length} of {fmtNum(visible.total)} nodes in view</span> : null}
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
                  <div style={{ position: "relative" }}>
                  <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${vbW} ${vbH}`} style={{ width: "100%", background: "var(--panel)", border: "1px solid var(--hairline)", borderRadius: 6, cursor: panning ? "grabbing" : "grab", touchAction: "none" }} role="img" aria-label="Transaction graph"
                    onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={endPan} onMouseLeave={endPan}>
                    {showGrid ? (
                      <defs>
                        <pattern id="vbh-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                          <circle cx="1.5" cy="1.5" r="1.5" fill="var(--hairline)" />
                        </pattern>
                      </defs>
                    ) : null}
                    {showGrid ? <rect x={0} y={0} width={W} height={H} fill="url(#vbh-grid)" /> : null}
                    <g transform={`translate(${view.x} ${view.y}) scale(${view.z})`}>
                    {(visible?.edges ?? []).map((e, i) => (
                      <g key={i}>
                        <line
                          x1={e.x1} y1={e.y1} x2={e.lx} y2={e.ly}
                          stroke={e.probabilistic ? "var(--signal)" : e.pathEdge ? "var(--ink)" : "var(--hairline)"}
                          strokeWidth={e.pathEdge ? 2 : 1.2}
                          strokeDasharray={e.probabilistic ? "6 4" : undefined}
                        />
                        {e.head ? (
                          <polygon
                            points={e.head}
                            fill={e.probabilistic ? "var(--signal)" : "var(--ink)"}
                          />
                        ) : null}
                        {e.label && showLabels ? (
                          <text x={(e.x1 + e.lx) / 2} y={(e.y1 + e.ly) / 2 - 6} textAnchor="middle" fontSize={10} fill="var(--tertiary)"
                            stroke="#ffffff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{e.label}</text>
                        ) : null}
                      </g>
                    ))}
                    {(visible?.placed ?? []).map((p) => {
                      const isSel = selected === p.node.id;
                      const fill = p.kind === "Subject" ? "var(--ink)" : p.kind === "Mixer" ? "var(--signal)" : p.kind === "VASP" ? "var(--panel)" : "var(--panel)";
                      const stroke = p.kind === "VASP" ? "var(--ink)" : p.kind === "Mixer" ? "var(--signal)" : "var(--slate-400)";
                      // Label block follows labDir so edges never strike through text.
                      const lx = p.labDir === "left" ? p.x - 12 : p.labDir === "right" ? p.x + 12 : p.x;
                      const anchor = p.labDir === "left" ? "end" : p.labDir === "right" ? "start" : "middle";
                      const kindY = p.labDir === "up" ? p.y - 30 : p.labDir === "down" ? p.y + 18 : p.y - 2;
                      const addrY = p.labDir === "up" ? p.y - 18 : p.labDir === "down" ? p.y + 30 : p.y + 12;
                      return (
                        <g key={p.node.id} data-node onClick={() => setSelected(p.node.id)} style={{ cursor: "pointer" }}>
                          {isSel ? <circle cx={p.x} cy={p.y} r={13} fill="none" stroke="var(--primary)" strokeWidth={2} /> : null}
                          <circle cx={p.x} cy={p.y} r={p.kind === "Subject" || p.kind === "VASP" ? 7 : 6} fill={fill} stroke={stroke} strokeWidth={p.kind === "VASP" ? 2 : 1.7} />
                          <text x={lx} y={kindY} textAnchor={anchor} fontSize={10} fill="var(--tertiary)"
                            stroke="#ffffff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{p.kind}</text>
                          <text x={lx} y={addrY} textAnchor={anchor} fontSize={10.5} fill="var(--ink)" fontFamily="var(--font-mono)"
                            stroke="#ffffff" strokeWidth={3} paintOrder="stroke" strokeLinejoin="round">{shortAddr(p.node.id)}</text>
                        </g>
                      );
                    })}
                    </g>
                  </svg>
                  <div style={{ position: "absolute", left: 12, bottom: 10, display: "flex", gap: 14, fontSize: 11, color: "var(--tertiary)", background: "rgba(255,255,255,0.85)", padding: "2px 6px", borderRadius: 4 }}>
                    <span><span style={{ color: "var(--ink)" }}>●</span> subject</span>
                    <span><span style={{ color: "var(--slate-400)" }}>○</span> peel</span>
                    <span><span style={{ color: "var(--slate-400)" }}>○</span> sweep</span>
                    <span><span style={{ color: "var(--signal)" }}>●</span> mixer</span>
                    <span><span style={{ color: "var(--ink)" }}>◯</span> VASP</span>
                    <span><span style={{ color: "var(--signal)" }}>┄</span> probabilistic</span>
                  </div>
                  <div style={{ position: "absolute", left: "50%", bottom: 10, transform: "translateX(-50%)", display: "flex", gap: 2, background: "#ffffff", border: "1px solid var(--hairline)", borderRadius: 999, padding: "4px 6px", boxShadow: "0 1px 4px rgba(20,24,43,0.08)" }}>
                    <PillBtn title="Select — click a node to inspect it; click again to clear" onClick={() => setSelected(null)} active={true}>
                      <path d="M4 3l7 14 2.5-6L20 8.5z" fill="none" strokeWidth="1.6" />
                    </PillBtn>
                    <PillBtn title="Fit view" onClick={resetView} active={false}>
                      <path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" strokeWidth="1.6" />
                    </PillBtn>
                    <PillBtn title={showLabels ? "Hide edge labels" : "Show edge labels"} onClick={() => setShowLabels((s) => !s)} active={showLabels}>
                      <path d="M10 14a4 4 0 005.7 0l2.8-2.8a4 4 0 00-5.7-5.7L11.5 6.7M14 10a4 4 0 00-5.7 0l-2.8 2.8a4 4 0 005.7 5.7l1.3-1.3" fill="none" strokeWidth="1.6" />
                    </PillBtn>
                    <div style={{ position: "relative" }}>
                      <PillBtn title="Edges in view — choose how many edges the canvas renders" onClick={() => setFilterOpen((o) => !o)} active={filterOpen}>
                        <path d="M4 5h16l-6 7v6l-4 2v-8z" fill="none" strokeWidth="1.6" strokeLinejoin="round" />
                      </PillBtn>
                      {filterOpen ? (
                        <div style={{ position: "absolute", bottom: 44, left: "50%", transform: "translateX(-50%)", background: "#ffffff", border: "1px solid var(--hairline)", borderRadius: 8, boxShadow: "0 4px 16px rgba(20,24,43,0.12)", padding: "10px 12px", minWidth: 190, zIndex: 20 }}>
                          <div className="section-label" style={{ marginBottom: 8 }}>Edges in view</div>
                          {[100, 250, 500, 1000, 2000].map((n) => (
                            <label key={n} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "4px 0", cursor: "pointer", color: "var(--body)" }}>
                              <input type="radio" name="edge-count" checked={edgeCount === n} onChange={() => changeEdgeCount(n)} />
                              <span className="t-num">{fmtNum(n)}</span>
                              {n === 2000 ? <span style={{ fontSize: 11, color: "var(--tertiary)" }}>(default)</span> : null}
                            </label>
                          ))}
                          <div style={{ borderTop: "1px solid var(--hairline)", margin: "8px 0" }} />
                          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", color: "var(--body)" }}>
                            <input type="checkbox" checked={showContext} onChange={() => setShowContext((s) => !s)} />
                            Show context nodes
                          </label>
                        </div>
                      ) : null}
                    </div>
                    <PillBtn title={showGrid ? "Hide grid" : "Show grid"} onClick={() => setShowGrid((s) => !s)} active={showGrid}>
                      <path d="M4 4h4v4H4zM10 4h4v4h-4zM16 4h4v4h-4zM4 10h4v4H4zM10 10h4v4h-4zM16 10h4v4h-4zM4 16h4v4H4zM10 16h4v4h-4zM16 16h4v4h-4z" fill="none" strokeWidth="1.2" />
                    </PillBtn>
                  </div>
                  </div>
                </>
              )}
              <div style={{ marginTop: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span className="section-label">Transaction activity</span>
                  <span className="endpoint-chip">GET /cases/{`{case_id}`}/graph/transactions</span>
                </div>
                <RecentTransactions caseId={props.caseId} />
              </div>
            </div>
            <div>
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                  <span className="section-label">Selected node</span>
                </div>
                {selectedNode ? (
                  <>
                    <div className="section-label" style={{ margin: "0 0 4px" }}>Address</div>
                    <div className="mono" style={{ fontSize: 13, wordBreak: "break-all", marginBottom: 12 }} title={selectedNode.id}>{shortAddr(selectedNode.id)}</div>
                    <div className="section-label" style={{ margin: "0 0 4px" }}>Kind</div>
                    <div style={{ fontSize: 13, marginBottom: 12 }}>{selectedKind(selectedNode, selectedHop, props.subject)}</div>
                    {selectedNode.pool ? (
                      <>
                        <div className="section-label" style={{ margin: "0 0 4px" }}>Pool</div>
                        <div style={{ fontSize: 13, marginBottom: 12 }}>{selectedNode.pool.display}</div>
                      </>
                    ) : null}
                    <div className="section-label" style={{ margin: "0 0 4px" }}>Confidence</div>
                    <div className="t-num" style={{ fontSize: 13, marginBottom: selectedHop?.reason ? 6 : 12 }}>
                      {selectedHop?.confidence != null ? selectedHop.confidence.toFixed(2) : "—"}
                    </div>
                    {selectedHop?.reason ? (
                      <p style={{ fontSize: 12, color: "var(--body)", margin: "0 0 12px" }}>{selectedHop.reason}</p>
                    ) : null}
                    <div className="section-label" style={{ margin: "0 0 4px" }}>Assessment</div>
                    <p style={{ fontSize: 12, color: "var(--body)", margin: "0 0 16px" }}>
                      {nodeAssessment(selectedNode, selectedHop, props.path, props.subject)}
                    </p>
                    <div className="section-label" style={{ margin: "0 0 8px" }}>Graph stats</div>
                    <div style={{ marginBottom: 6 }}>
                      <span className="endpoint-chip">GET /cases/{`{case_id}`}/graph/stats</span>
                    </div>
                    {statRows.map(([label, value]) => (
                      <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", fontSize: 13 }}>
                        <span style={{ color: "var(--body)" }}>{label}</span>
                        <span className="t-num">{fmtNum(value)}</span>
                      </div>
                    ))}
                  </>
                ) : (
                  <Empty title="No node selected" hint="Click a node on the canvas to inspect it." />
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
