import Link from "next/link";
import { notFound } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { Empty, Unavailable } from "@/components/state";
import { getSahyogCase } from "@/lib/api/sahyog";
import { ApiError } from "@/lib/api/server";
import { fmtDate } from "@/lib/format";

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

/**
 * Filing detail. The durable GET /filings/{id} does not exist yet; the page
 * resolves mock-submitted cases via :8091 GET /sahyog/cases/{case_id} and is
 * honest about everything the mock cannot provide.
 */
export default async function FilingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let filing: Record<string, unknown>;
  try {
    filing = await getSahyogCase(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      return (
        <Chrome crumb={`Filings › ${id}`}>
          <Empty title="SAHYOG mock unreachable" hint="Start the mock on :8091 to view this filing." />
        </Chrome>
      );
    }
    throw err;
  }
  if ((filing as { error?: string }).error) notFound();

  const str = (k: string) => {
    const v = filing[k];
    return v === undefined || v === null ? "—" : String(v);
  };

  return (
    <Chrome crumb={`Filings › ${id}`}>
      <p className="crumb">Filings › {id}</p>
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title mono" style={{ letterSpacing: "-0.01em" }}>{id}</h1>
            <p className="page-sub">
              Filed {filing.submitted_at ? fmtDate(String(filing.submitted_at)) : "—"}
              {filing.chain ? ` · ${String(filing.chain)}` : ""}
            </p>
          </div>
          <Link href="/filings" className="btn-secondary">Back to register</Link>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40 }}>
        <div style={{ maxWidth: 720 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Filing summary</span>
            <span className="endpoint-chip">:8091 GET /sahyog/cases/{`{case_id}`}</span>
          </div>
          <Kv rows={[
            ["Subject", <span className="mono">{str("suspect_address")}</span>],
            ["Chain", <span style={{ textTransform: "capitalize" }}>{str("chain")}</span>],
            ["FIR number", str("fir_number")],
            ["Officer", str("officer_id")],
            ["Jurisdiction", str("jurisdiction")],
            ["Status", <span style={{ textTransform: "capitalize" }}>{str("status")}</span>],
            ["Submitted", filing.submitted_at ? fmtDate(String(filing.submitted_at)) : "—"],
            ["Notes", str("notes")],
          ]} />
          <div style={{ marginTop: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <span className="section-label">Transmission & acknowledgement</span>
            </div>
            <Unavailable endpoint="GET /filings/{filing_id}" what="Transmission log, ack reference and signature state" />
          </div>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Attribution webhook</span>
          </div>
          <Unavailable endpoint="POST /filings/{filing_id}/resend" what="Signed webhook re-send" />
        </div>
      </div>
    </Chrome>
  );
}
