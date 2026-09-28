import { vasp } from "./server";

/** Trace job — POST /jobs/trace, GET /jobs/{job_id}. */
export type TraceJob = {
  job_id: string;
  case_id: string;
  address: string;
  chain: string;
  status: string;
  error: string | null;
  report_id: string | null;
  webhook_status: string | null;
};

export function startTrace(caseId: string, address?: string, chain?: string) {
  return vasp.post<{ job_id: string; status: string }>("/jobs/trace", {
    case_id: caseId,
    ...(address ? { address } : {}),
    ...(chain ? { chain } : {}),
  });
}

export function getJob(jobId: string) {
  return vasp.get<TraceJob>(`/jobs/${jobId}`);
}
