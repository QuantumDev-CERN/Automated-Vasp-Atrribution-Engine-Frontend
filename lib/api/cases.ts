import { vasp } from "./server";

/** Case record — GET /cases/{case_id}, POST /cases. */
export type CaseRec = {
  case_id: string;
  fir_number: string;
  suspect_address: string;
  chain: string;
  officer_id: string;
  notes: string;
  jurisdiction: string;
  status: string;
  created_at: string;
};

export type CaseSubmit = {
  fir_number: string;
  suspect_address: string;
  chain: string;
  officer_id?: string;
  notes?: string;
  jurisdiction?: string;
};

export function getCase(caseId: string) {
  return vasp.get<CaseRec>(`/cases/${caseId}`);
}

export function submitCase(payload: CaseSubmit) {
  return vasp.post<{ case_id: string; status: string }>("/cases", payload);
}

/** Latest trace outcome summary — GET /cases/{case_id}/latest (M26). */
export type ReportSummary = {
  job_id: string;
  report_id: string;
  risk_score: number | null;
  risk_level: string | null;
  confidence: number | null;
  terminal_address: string | null;
  terminal_reason: string | null;
  hop_count: number | null;
  webhook_status: string | null;
  generated_at: string;
} | null;

/** One row of the case register — GET /cases (M26). */
export type CaseListRow = CaseRec & { latest: ReportSummary };

export type CaseList = {
  cases: CaseListRow[];
  total: number;
  limit: number;
  offset: number;
};

export function listCases(opts: { status?: string; q?: string; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("status", opts.status);
  if (opts.q) qs.set("q", opts.q);
  if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
  if (opts.offset !== undefined) qs.set("offset", String(opts.offset));
  const q = qs.toString();
  return vasp.get<CaseList>(`/cases${q ? `?${q}` : ""}`);
}

/** Case → latest trace job + report + certificate — GET /cases/{id}/latest (M26). */
export type CaseLatest = {
  case_id: string;
  case: CaseRec;
  job: {
    job_id: string;
    address: string;
    chain: string;
    status: string;
    error: string | null;
    created_at: string;
    updated_at: string;
  } | null;
  report: ReportSummary;
  certificate: {
    report_hash: string;
    inputs_hash: string;
    statement: string;
    engine_version: string;
    generated_at: string;
  } | null;
};

export function getLatest(caseId: string) {
  return vasp.get<CaseLatest>(`/cases/${caseId}/latest`);
}
