import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { Empty, PageError } from "@/components/state";
import { listCases, type CaseListRow } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/server";
import { shortAddr, fmtDate } from "@/lib/format";

const PAGE_SIZE = 20;
/** Case statuses the backend actually emits: "received" on registration,
 * "attributed" when a trace completes. */
const STATUS_TABS = ["received", "attributed"] as const;

async function openCase(formData: FormData) {
  "use server";
  const id = String(formData.get("case_id") ?? "").trim();
  if (id) redirect(`/cases/${encodeURIComponent(id)}`);
}

function riskCell(row: CaseListRow) {
  const l = row.latest;
  if (!l || l.risk_score === null || l.risk_score === undefined) return "—";
  return `${l.risk_score}${l.risk_level ? ` (${l.risk_level})` : ""}`;
}

function confCell(row: CaseListRow) {
  const l = row.latest;
  if (!l || l.confidence === null || l.confidence === undefined) return "—";
  return l.confidence.toFixed(2);
}

function terminalCell(row: CaseListRow) {
  const l = row.latest;
  if (!l || !l.terminal_address) return "—";
  return (
    <span className="mono" title={`${l.terminal_address}${l.terminal_reason ? ` — ${l.terminal_reason}` : ""}`}>
      {shortAddr(l.terminal_address)}
    </span>
  );
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const qs = await searchParams;
  const status = (qs.status ?? "").trim() || undefined;
  const q = (qs.q ?? "").trim() || undefined;
  const page = Math.max(1, Number(qs.page ?? 1) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let list;
  try {
    list = await listCases({ status, q, limit: PAGE_SIZE, offset });
  } catch (err) {
    return (
      <Chrome crumb="Cases">
        <PageError title="Could not load case register" error={err} />
      </Chrome>
    );
  }

  const totalPages = Math.max(1, Math.ceil(list.total / PAGE_SIZE));
  const tabHref = (s?: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (q) p.set("q", q);
    return `/cases${p.toString() ? `?${p}` : ""}`;
  };
  const pageHref = (p: number) => {
    const sp = new URLSearchParams();
    if (status) sp.set("status", status);
    if (q) sp.set("q", q);
    sp.set("page", String(p));
    return `/cases?${sp}`;
  };

  return (
    <Chrome crumb="Cases">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Cases</h1>
            <p className="page-sub">
              {list.total} case{list.total === 1 ? "" : "s"} registered in the engine
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">POST /cases</span>
            <Link href="/cases/new" className="btn-primary">+ New case</Link>
          </div>
        </div>
      </div>

      <form action={openCase} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 28 }}>
        <input
          name="case_id"
          className="search-input"
          placeholder="Open a case by ID"
          style={{ minWidth: 320 }}
          required
        />
        <button type="submit" className="btn-secondary">Open</button>
        <span className="endpoint-chip">GET /cases/{`{case_id}`}</span>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span className="section-label">Register</span>
        <span className="endpoint-chip">GET /cases</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 16 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <Link href={tabHref()} className={"tab" + (!status ? " active" : "")}>All</Link>
          {STATUS_TABS.map((s) => (
            <Link key={s} href={tabHref(s)} className={"tab" + (status === s ? " active" : "")}
              style={{ textTransform: "capitalize" }}>
              {s}
            </Link>
          ))}
        </div>
        <form method="get" action="/cases" style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          {status ? <input type="hidden" name="status" value={status} /> : null}
          <input name="q" className="search-input" placeholder="Search FIR, address, officer" defaultValue={q ?? ""} />
          <button type="submit" className="btn-secondary">Search</button>
        </form>
      </div>

      {list.cases.length ? (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>FIR number</th><th>Subject</th><th>Chain</th><th>Status</th>
                <th>Risk</th><th>Confidence</th><th>Terminal</th><th>Opened</th>
                <th className="cell-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {list.cases.map((c) => (
                <tr key={c.case_id}>
                  <td className="t-ink mono">{c.fir_number}</td>
                  <td className="mono" title={c.suspect_address}>{shortAddr(c.suspect_address)}</td>
                  <td style={{ textTransform: "capitalize" }}>{c.chain}</td>
                  <td style={{ textTransform: "capitalize" }}>{c.status}</td>
                  <td className="t-num">{riskCell(c)}</td>
                  <td className="t-num">{confCell(c)}</td>
                  <td>{terminalCell(c)}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{fmtDate(c.created_at)}</td>
                  <td className="cell-end">
                    <Link href={`/cases/${c.case_id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 12, fontSize: 12, color: "var(--tertiary)" }}>
            <span>Page {page} of {totalPages} · {list.total} total</span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              {page > 1 ? <Link href={pageHref(page - 1)} className="btn-secondary">← Prev</Link> : null}
              {page < totalPages ? <Link href={pageHref(page + 1)} className="btn-secondary">Next →</Link> : null}
            </span>
          </div>
        </>
      ) : (
        <Empty
          title={q || status ? "No cases match" : "No cases registered yet"}
          hint={q || status ? "Try a different search or status filter." : "Register the first case with + New case."}
        />
      )}
    </Chrome>
  );
}
