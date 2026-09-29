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
  /** Human-denominated value (coin units); prefer over value for display. */
  value_denominated?: string | null;
  asset_kind: string | null;
  asset_symbol: string | null;
  asset_contract: string | null;
  asset_decimals?: number | null;
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
  /** Human-denominated value (coin units); prefer over value for display. */
  value_denominated?: string | null;
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

/** Ranked intelligence entry — GET /intel/links/ranked (M26). */
export type RankedEntry = {
  tag: string;
  address_count: number;
  case_count: number;
  cases: string[];
  addresses: { address: string; chain: string }[];
};

export function getRankedIntel(limit = 50) {
  return vasp.get<{ ranked: RankedEntry[]; total_tags: number }>(
    `/intel/links/ranked?limit=${limit}`
  );
}

export function getGraphTopology(caseId: string, maxNodes = 500, maxEdges = 2000) {
  return vasp.get<GraphTopology>(
    `/cases/${caseId}/graph?max_nodes=${maxNodes}&max_edges=${maxEdges}`
  );
}

export function getGraphPath(caseId: string) {
  return vasp.get<GraphPath>(`/cases/${caseId}/graph/path`);
}

export function getGraphStats(caseId: string) {
  return vasp.get<GraphStats>(`/cases/${caseId}/graph/stats`);
}

/** Graph stats — GET /cases/{case_id}/graph/stats (M11, enriched M26 with
 * classifier breakdown + daily activity from persisted hop meta). */
export type GraphStats = {
  case_id: string;
  backend: string;
  classifier_breakdown: Record<string, number>;
  daily_activity: { date: string; transactions: number; transfers: number }[];
} & Record<string, number | Record<string, number> | { date: string; transactions: number; transfers: number }[]>;

export function getCaseLinks(caseId: string, minOverlap = 1) {
  return vasp.get<CaseLinks>(`/cases/${caseId}/links?min_overlap=${minOverlap}`);
}

export function getInfrastructure(tag: string) {
  return vasp.get<InfraPivot>(`/intel/infrastructure/${encodeURIComponent(tag)}`);
}
