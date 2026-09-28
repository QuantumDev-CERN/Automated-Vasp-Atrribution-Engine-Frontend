import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { PageError, Empty } from "@/components/state";
import { WorkbenchView } from "@/components/workbench/WorkbenchView";
import { getCase } from "@/lib/api/cases";
import { getGraphTopology, getGraphPath, getGraphStats, getCaseLinks, getInfrastructure } from "@/lib/api/graph";
import { getJob, startTrace } from "@/lib/api/jobs";
import { ApiError } from "@/lib/api/server";

async function openWorkbench(formData: FormData) {
  "use server";
  const id = String(formData.get("case_id") ?? "").trim();
  if (id) redirect(`/workbench?case=${encodeURIComponent(id)}`);
}

async function runTrace(formData: FormData) {
  "use server";
  const caseId = String(formData.get("case_id") ?? "");
  try {
    const job = await startTrace(caseId);
    redirect(`/workbench?case=${encodeURIComponent(caseId)}&job=${encodeURIComponent(job.job_id)}`);
  } catch (err) {
    const msg = err instanceof ApiError ? `api-${err.status}` : "failed";
    redirect(`/workbench?case=${encodeURIComponent(caseId)}&trace=${encodeURIComponent(msg)}`);
  }
}

export default async function WorkbenchPage({
  searchParams,
}: {
  searchParams: Promise<{ case?: string; job?: string; trace?: string }>;
}) {
  const qs = await searchParams;
  const caseId = (qs.case ?? "").trim();

  if (!caseId) {
    return (
      <Chrome crumb="Workbench">
        <div className="page-head">
          <h1 className="page-title">Trace workbench</h1>
          <p className="page-sub">Open a case to inspect its traced graph</p>
        </div>
        <form action={openWorkbench} style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <input name="case_id" className="search-input" style={{ minWidth: 320 }} placeholder="Case ID" required />
          <button type="submit" className="btn-secondary">Open</button>
          <span className="endpoint-chip">GET /cases/{`{case_id}`}/graph</span>
        </form>
      </Chrome>
    );
  }

  let caseRec = null;
  try {
    caseRec = await getCase(caseId);
  } catch (err) {
    if (err instanceof ApiError && err.notFound) {
      return (
        <Chrome crumb="Workbench">
          <PageError title={`Case ${caseId} not found`} error={err} />
        </Chrome>
      );
    }
    return (
      <Chrome crumb="Workbench">
        <PageError title={`Could not load case ${caseId}`} error={err} />
      </Chrome>
    );
  }

  const [topoR, pathR, statsR, linksR, jobR] = await Promise.allSettled([
    getGraphTopology(caseId),
    getGraphPath(caseId),
    getGraphStats(caseId),
    getCaseLinks(caseId),
    qs.job ? getJob(qs.job) : Promise.resolve(null),
  ]);
  const topology = topoR.status === "fulfilled" ? topoR.value : null;
  const topoError = topoR.status === "rejected" ? topoR.reason : null;
  const path = pathR.status === "fulfilled" ? pathR.value : null;
  const stats = statsR.status === "fulfilled" ? statsR.value : null;
  const links = linksR.status === "fulfilled" ? linksR.value : null;
  const job = jobR.status === "fulfilled" ? jobR.value : null;

  const firstTag = links?.links?.[0]?.shared_tags?.[0];
  const infra = firstTag ? await getInfrastructure(firstTag).catch(() => null) : null;

  return (
    <Chrome crumb={`Cases › ${caseId} › Trace workbench`}>
      <WorkbenchView
        caseId={caseId}
        subject={caseRec.suspect_address}
        topology={topology}
        topoError={topoError ? String(topoError) : null}
        path={path}
        stats={stats}
        links={links}
        infra={infra}
        infraTag={firstTag ?? null}
        job={job}
        jobId={qs.job ?? null}
        traceError={qs.trace}
        runTrace={runTrace}
      />
    </Chrome>
  );
}
