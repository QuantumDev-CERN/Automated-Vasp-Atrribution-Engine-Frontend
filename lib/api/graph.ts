import { vasp } from "./server";

/** Graph topology node/edge — GET /cases/{case_id}/graph (M11). */
export type GraphNode = {
  id: string;
  chains: string[];
  labels: string[];
  first_seen: string | null;
  degree: number;
  tags?: string[];
};
export type GraphEdge = {
  src: string;
  dst: string;
  tx_hash: string | null;
  value: string;
  asset_kind: string | null;
  asset_symbol: string | null;
  asset_contract: string | null;
  block_time: string | null;
  block_number: number | null;
};
export type GraphTopology = {
  case_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  total_addresses: number;
  total_transfers: number;
};

/** Subject -> terminal hop — GET /cases/{case_id}/graph/path (M11). */
export type PathHop = {
  hop: number;
  address: string;
  via_tx?: string | null;
  value?: string | null;
  asset_symbol?: string | null;
  block_time?: string | null;
  kind?: string | null;
  confidence?: number | null;
  reason?: string | null;
};
export type GraphPath = {
  case_id: string;
  subject: string;
  terminal: string;
  hops: PathHop[];
};

/** Cross-case link — GET /cases/{case_id}/links (M9). */
export type CaseLink = {
  case_id: string;
  overlap: number;
  shared_addresses: string[];
  shared_tags: string[];
};
export type CaseLinks = { case_id: string; summary: string; links: CaseLink[] };

/** Common-infrastructure pivot — GET /intel/infrastructure/{tag} (M9). */
export type InfraPivot = {
  tag: string;
  addresses: { address: string; chain: string }[];
  address_count: number;
};

export function getGraphTopology(caseId: string, maxNodes = 500, maxEdges = 2000) {
  return vasp.get<GraphTopology>(
    `/cases/${caseId}/graph?max_nodes=${maxNodes}&max_edges=${maxEdges}`
  );
}

export function getGraphPath(caseId: string) {
  return vasp.get<GraphPath>(`/cases/${caseId}/graph/path`);
}

export function getGraphStats(caseId: string) {
  return vasp.get<{ case_id: string; backend: string } & Record<string, number>>(
    `/cases/${caseId}/graph/stats`
  );
}

export function getCaseLinks(caseId: string, minOverlap = 1) {
  return vasp.get<CaseLinks>(`/cases/${caseId}/links?min_overlap=${minOverlap}`);
}

export function getInfrastructure(tag: string) {
  return vasp.get<InfraPivot>(`/intel/infrastructure/${encodeURIComponent(tag)}`);
}
