import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { Empty, PageError } from "@/components/state";
import { getFiling, resendFiling } from "@/lib/api/filings";
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

async function resend(formData: FormData) {
  "use server";
  const filingId = String(formData.get("filing_id") ?? "");
  try {
    const out = await resendFiling(filingId);
    redirect(`/filings/${encodeURIComponent(out.filing_id)}?resent=1`);
  } catch (err) {
    const msg = err instanceof ApiError ? `api-${err.status}` : "failed";
    redirect(`/filings/${encodeURIComponent(filingId)}?error=${encodeURIComponent(msg)}`);
  }
}

/** Filing detail — GET /filings/{filing_id} (M26). */
export default async function FilingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resent?: string; error?: string }>;
}) {
  const { id } = await params;
  const qs = await searchParams;

  let filing;
  try {
    filing = await getFiling(id);
  } catch (err) {
    if (err instanceof ApiError && err.notFound) notFound();
    return (
      <Chrome crumb={`Filings › ${id.slice(0, 8)}`}>
        <PageError title={`Could not load filing ${id}`} error={err} />
      </Chrome>
    );
  }

  const r = filing.report;
  const shortId = id.length > 8 ? id.slice(0, 8) : id;

  return (
    <Chrome crumb={`Filings › ${shortId}`}>
      <p className="crumb">Filings › {shortId}</p>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title mono" style={{ letterSpacing: "-0.01em" }}>{shortId}</h1>
            <p className="page-sub">
              Filed {fmtDate(filing.filed_at)}
              {filing.fir_number ? ` · FIR ${filing.fir_number}` : ""}
              {filing.chain ? ` · ${filing.chain}` : ""}
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">GET /filings/{`{filing_id}`}</span>
            <Link href="/filings" className="btn-secondary">Back to register</Link>
          </div>
        </div>
        {qs.resent ? (
          <p style={{ fontSize: 12, color: "var(--ok-text)", marginTop: 8 }}>
            Webhook re-sent — recorded as a new filing row; the original is untouched.
          </p>
        ) : null}
        {qs.error ? (
          <p style={{ fontSize: 12, color: "var(--signal)", marginTop: 8 }}>
            Re-send failed ({qs.error}).
          </p>
        ) : null}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40 }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Filing summary</span>
            <span className="endpoint-chip">GET /filings/{`{filing_id}`}</span>
          </div>
          <Kv rows={[
            ["Filing ID", <span className="mono" style={{ fontSize: 11 }}>{filing.filing_id}</span>],
            ["Subject", filing.suspect_address ? <span className="mono">{filing.suspect_address}</span> : "—"],
            ["Chain", filing.chain ? <span style={{ textTransform: "capitalize" }}>{filing.chain}</span> : "—"],
            ["FIR number", filing.fir_number ?? "—"],
            ["Channel", <span className="mono" style={{ fontSize: 11 }}>{filing.channel}</span>],
            ["Status", <span style={{ textTransform: "capitalize" }}>{filing.status}</span>],
            ["Case", <Link href={`/cases/${filing.case_id}`} className="mono" style={{ fontSize: 11 }}>{filing.case_id.slice(0, 8)}</Link>],
            ["Acknowledgement", filing.ack_ref ? <span className="mono" style={{ fontSize: 11 }}>{filing.ack_ref}</span> : "— (no acknowledgement reference issued)"],
          ]} />
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="section-label">Transmission log</span>
            </div>
            <Kv rows={[
              ["Attempts", String(filing.transmission.attempts)],
              ["Outcome", <span style={{ textTransform: "capitalize" }}>{filing.transmission.status}</span>],
              ["Error", filing.transmission.error || "—"],
            ]} />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Linked report</span>
          </div>
          {r ? (
            <>
              <Kv rows={[
                ["Risk", r.risk_score === null || r.risk_score === undefined ? "—"
                  : `${r.risk_score}${r.risk_level ? ` (${r.risk_level})` : ""}`],
                ["Confidence", r.confidence === null || r.confidence === undefined ? "—" : r.confidence.toFixed(2)],
                ["Terminal", r.terminal_address
                  ? <span className="mono" title={`${r.terminal_address}${r.terminal_reason ? ` — ${r.terminal_reason}` : ""}`} style={{ fontSize: 11 }}>{shortAddr(r.terminal_address)}</span>
                  : "—"],
                ["Report hash", <span className="mono" title={r.report_hash} style={{ fontSize: 11 }}>{shortAddr(r.report_hash)}</span>],
              ]} />
              <div style={{ marginTop: 12 }}>
                <Link href={`/reports/${r.report_id}`} className="btn-secondary">Open full report</Link>
              </div>
            </>
          ) : (
            <Empty title="No report linked" hint="This filing has no report attached." />
          )}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="section-label">Attribution webhook</span>
              <span className="endpoint-chip">POST /filings/{`{filing_id}`}/resend</span>
            </div>
            <p style={{ fontSize: 12, color: "var(--tertiary)", margin: "0 0 12px" }}>
              Re-sends the signed attribution webhook server-side and records a new filing row.
            </p>
            <form action={resend}>
              <input type="hidden" name="filing_id" value={id} />
              <button type="submit" className="btn-primary">Re-send webhook</button>
            </form>
          </div>
        </div>
      </div>
    </Chrome>
  );
}
