import { vasp } from "./server";

/** Filing record — GET /filings (M26). */
export type FilingRec = {
  filing_id: string;
  case_id: string;
  report_id: string;
  fir_number: string | null;
  suspect_address: string | null;
  chain: string | null;
  channel: string;
  status: string;
  ack_ref: string | null;
  error: string | null;
  attempts: number;
  filed_at: string;
};

export type FilingList = {
  filings: FilingRec[];
  total: number;
  limit: number;
  offset: number;
};

export function listFilings(opts: { status?: string; case_id?: string; limit?: number; offset?: number } = {}) {
  const qs = new URLSearchParams();
  if (opts.status) qs.set("status", opts.status);
  if (opts.case_id) qs.set("case_id", opts.case_id);
  if (opts.limit !== undefined) qs.set("limit", String(opts.limit));
  if (opts.offset !== undefined) qs.set("offset", String(opts.offset));
  const q = qs.toString();
  return vasp.get<FilingList>(`/filings${q ? `?${q}` : ""}`);
}

/** Filing detail — GET /filings/{filing_id} (M26). */
export type FilingDetail = FilingRec & {
  transmission: { attempts: number; status: string; error: string | null };
  report: {
    report_id: string;
    report_hash: string;
    risk_score: number | null;
    risk_level: string | null;
    confidence: number | null;
    terminal_address: string | null;
    terminal_reason: string | null;
  } | null;
};

export function getFiling(filingId: string) {
  return vasp.get<FilingDetail>(`/filings/${filingId}`);
}

/** Signed re-send — POST /filings/{filing_id}/resend (M26). Records a NEW
 * filing row; the original is untouched. */
export type FilingResend = {
  filing_id: string;
  resent_from: string;
  status: string;
  attempts: number;
  error: string | null;
};

export function resendFiling(filingId: string) {
  return vasp.post<FilingResend>(`/filings/${filingId}/resend`);
}
