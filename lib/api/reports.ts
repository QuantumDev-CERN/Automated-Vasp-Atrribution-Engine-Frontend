import { vasp } from "./server";

/** Investigation report + evidentiary certificate — GET /reports/{report_id} (M6/M7). */
export type Report = {
  report_id: string;
  job_id: string;
  case_id: string;
  report_hash: string;
  inputs_hash: string;
  generated_at: string;
  engine_version: string;
  certificate_statement: string;
  webhook_status: string;
  report_text: string;
};

export function getReport(reportId: string) {
  return vasp.get<Report>(`/reports/${reportId}`);
}
