import Link from "next/link";
import { notFound } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { Empty, PageError } from "@/components/state";
import { getReport } from "@/lib/api/reports";
import { ApiError } from "@/lib/api/server";
import { shortAddr, fmtDate } from "@/lib/format";

function Kv({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div className="kv-row" key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Full investigation report + evidentiary certificate — GET /reports/{report_id}. */
export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let report;
  try {
    report = await getReport(id);
  } catch (err) {
    if (err instanceof ApiError && err.notFound) notFound();
    return (
      <Chrome crumb={`Reports › ${id.slice(0, 8)}`}>
        <PageError title={`Could not load report ${id}`} error={err} />
      </Chrome>
    );
  }

  return (
    <Chrome crumb={`Reports › ${id.slice(0, 8)}`}>
      <p className="crumb">Reports › {id.slice(0, 8)}</p>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Investigation report</h1>
            <p className="page-sub">
              Case <Link href={`/cases/${report.case_id}`} className="mono">{report.case_id}</Link>
              {" · "}generated {fmtDate(report.generated_at)}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">GET /reports/{`{report_id}`}</span>
            <Link href={`/cases/${report.case_id}`} className="btn-secondary">Back to case</Link>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40 }}>
        <div style={{ maxWidth: 780 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Report body</span>
          </div>
          {report.report_text ? (
            <pre
              className="mono"
              style={{
                fontSize: 12, lineHeight: 1.7, whiteSpace: "pre-wrap",
                wordBreak: "break-word", margin: 0, color: "var(--body)",
              }}
            >
              {report.report_text}
            </pre>
          ) : (
            <Empty title="Report body unavailable" hint="The engine stored no text for this report." />
          )}
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Evidentiary certificate</span>
          </div>
          <Kv rows={[
            ["Report hash", <span className="mono" title={report.report_hash} style={{ fontSize: 11 }}>{shortAddr(report.report_hash)}</span>],
            ["Inputs hash", <span className="mono" title={report.inputs_hash} style={{ fontSize: 11 }}>{shortAddr(report.inputs_hash)}</span>],
            ["Engine", <span className="mono">{report.engine_version}</span>],
            ["Generated", fmtDate(report.generated_at)],
            ["Webhook", <span style={{ textTransform: "capitalize" }}>{report.webhook_status}</span>],
            ["Statement", <span style={{ fontSize: 12 }}>{report.certificate_statement}</span>],
          ]} />
        </div>
      </div>
    </Chrome>
  );
}
