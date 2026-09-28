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
