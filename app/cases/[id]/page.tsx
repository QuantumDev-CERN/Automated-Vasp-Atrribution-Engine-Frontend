import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { PageError } from "@/components/state";
import { CaseDetailTabs } from "@/components/cases/CaseDetailTabs";
import { getCase, getLatest } from "@/lib/api/cases";
import { getGraphPath, getCaseLinks, getInfrastructure } from "@/lib/api/graph";
import { listFilings } from "@/lib/api/filings";
import { listOutcomes } from "@/lib/api/feedback";
import { startTrace } from "@/lib/api/jobs";
import { recordOutcome } from "@/lib/api/feedback";
import { ApiError } from "@/lib/api/server";
import { shortAddr, fmtDate } from "@/lib/format";

async function runTrace(formData: FormData) {
  "use server";
  const caseId = String(formData.get("case_id") ?? "");
  try {
    const job = await startTrace(caseId);
    redirect(`/workbench?case=${encodeURIComponent(caseId)}&job=${encodeURIComponent(job.job_id)}`);
  } catch (err) {
    const msg = err instanceof ApiError ? `api-${err.status}` : "failed";
    redirect(`/cases/${encodeURIComponent(caseId)}?trace=${encodeURIComponent(msg)}`);
  }
}

async function submitOutcome(formData: FormData) {
  "use server";
  const caseId = String(formData.get("case_id") ?? "");
  try {
    await recordOutcome({
      case_id: caseId,
      vasp: String(formData.get("vasp") ?? "").trim(),
      predicted_confidence: Number(formData.get("predicted_confidence") ?? 0),
      outcome: String(formData.get("outcome") ?? "inconclusive"),
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    });
    redirect(`/cases/${encodeURIComponent(caseId)}?tab=feedback&saved=1`);
  } catch (err) {
    const msg = err instanceof ApiError ? `api-${err.status}` : "failed";
    redirect(`/cases/${encodeURIComponent(caseId)}?tab=feedback&error=${encodeURIComponent(msg)}`);
  }
}

export default async function CaseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; trace?: string; saved?: string; error?: string }>;
}) {
  const { id } = await params;
  const qs = await searchParams;

  let caseRec;
  try {
    caseRec = await getCase(id);
  } catch (err) {
    if (err instanceof ApiError && err.notFound) notFound();
    return (
      <Chrome crumb={`Cases › ${id}`}>
        <PageError title={`Could not load case ${id}`} error={err} />
      </Chrome>
    );
  }

  // Independent panels; one failing must not kill the page.
  const [latestR, pathR, linksR, outcomesR, filingsR] = await Promise.allSettled([
    getLatest(id),
    getGraphPath(id),
    getCaseLinks(id),
    listOutcomes(),
    listFilings({ case_id: id, limit: 50 }),
  ]);
  const latest = latestR.status === "fulfilled" ? latestR.value : null;
  const path = pathR.status === "fulfilled" ? pathR.value : null;
  const links = linksR.status === "fulfilled" ? linksR.value : null;
  const outcomes = outcomesR.status === "fulfilled"
    ? outcomesR.value.outcomes.filter((o) => o.case_id === id)
    : null;
  const filings = filingsR.status === "fulfilled" ? filingsR.value.filings : null;

  // Shared-infrastructure pivot follows the first analyst-curated tag on the
  // strongest cross-case link — real tag, real lookup, no invented pivot.
  const firstTag = links?.links?.[0]?.shared_tags?.[0];
  const infra = firstTag
    ? await getInfrastructure(firstTag).catch(() => null)
    : null;

  const reportId = latest?.report?.report_id ?? null;

  return (
    <Chrome crumb={`Cases › ${id}`}>
      <p className="crumb">Cases › {id}</p>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title mono" style={{ letterSpacing: "-0.01em" }}>{id}</h1>
            <p className="page-sub">
              Subject {shortAddr(caseRec.suspect_address)} · opened {fmtDate(caseRec.created_at)}
              {caseRec.officer_id ? ` · officer ${caseRec.officer_id}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <Link href="/cases" className="btn-secondary">Back to cases</Link>
            {reportId ? (
              <Link href={`/reports/${reportId}`} className="btn-primary">
                Open report
              </Link>
            ) : (
              <button
                className="btn-primary"
                disabled
                title="No trace report yet — run a trace first"
                style={{ opacity: 0.55, cursor: "not-allowed" }}
              >
                Open report
              </button>
            )}
            <form action={runTrace}>
              <input type="hidden" name="case_id" value={id} />
              <button type="submit" className="btn-primary" style={{ background: "var(--primary)" }}>
                Run trace
              </button>
            </form>
          </div>
        </div>
        <div style={{ marginTop: 8, display: "flex", gap: 8, alignItems: "center" }}>
          <span className="endpoint-chip">POST /jobs/trace</span>
          {reportId ? <span className="endpoint-chip">GET /cases/{`{case_id}`}/latest</span> : null}
          {qs.trace ? <span style={{ fontSize: 12, color: "var(--signal)" }}>Trace failed to start ({qs.trace}).</span> : null}
        </div>
      </div>

      <CaseDetailTabs
        initialTab={qs.tab ?? "overview"}
        caseRec={caseRec}
        latest={latest}
        path={path}
        links={links}
        infra={infra}
        infraTag={firstTag ?? null}
        outcomes={outcomes}
        filings={filings}
        submitOutcome={submitOutcome}
        saved={qs.saved === "1"}
        formError={qs.error}
      />
    </Chrome>
  );
}
