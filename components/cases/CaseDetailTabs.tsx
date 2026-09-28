"use client";

import Link from "next/link";
import { useState } from "react";
import { PathHops } from "@/components/workbench/PathHops";
import { Empty } from "@/components/state";
import { shortAddr, fmtDate } from "@/lib/format";
import type { CaseRec, CaseLatest } from "@/lib/api/cases";
import type { FilingRec } from "@/lib/api/filings";
import type { GraphPath, CaseLinks, InfraPivot } from "@/lib/api/graph";
import type { Outcome } from "@/lib/api/feedback";

const TABS = ["overview", "path", "filings", "feedback"] as const;
type Tab = (typeof TABS)[number];

type Props = {
  initialTab: string;
  caseRec: CaseRec;
  latest: CaseLatest | null;
  path: GraphPath | null;
  links: CaseLinks | null;
  infra: InfraPivot | null;
  infraTag: string | null;
  outcomes: Outcome[] | null;
  filings: FilingRec[] | null;
  submitOutcome: (formData: FormData) => void;
  saved: boolean;
  formError?: string;
};

function Card({ title, endpoint, children, wide }: { title: string; endpoint?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section style={{ marginBottom: 28, maxWidth: wide ? "none" : 720 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span className="section-label">{title}</span>
        {endpoint ? <span className="endpoint-chip">{endpoint}</span> : null}
      </div>
      {children}
    </section>
  );
}

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

const radioRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13 };

export function CaseDetailTabs(props: Props) {
  const [tab, setTab] = useState<Tab>(TABS.includes(props.initialTab as Tab) ? (props.initialTab as Tab) : "overview");
  const { caseRec, latest } = props;
  const summary = latest?.report ?? null;
  const cert = latest?.certificate ?? null;

  return (
    <div>
      <div className="tabs" style={{ marginBottom: 24 }}>
        {TABS.map((t) => (
          <button key={t} className={"tab" + (tab === t ? " active" : "")} onClick={() => setTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40 }}>
          <div>
            <Card title="Case summary" endpoint="GET /cases/{case_id}">
              <Kv rows={[
                ["Status", <span style={{ textTransform: "capitalize" }}>{caseRec.status}</span>],
                ["Subject", <span className="mono">{caseRec.suspect_address}</span>],
                ["Chain", <span style={{ textTransform: "capitalize" }}>{caseRec.chain}</span>],
                ["Opened", fmtDate(caseRec.created_at)],
                ["Officer", caseRec.officer_id || "—"],
                ["Jurisdiction", caseRec.jurisdiction || "—"],
                ...(caseRec.notes ? [["Notes", caseRec.notes] as [string, React.ReactNode]] : []),
              ]} />
            </Card>
            <Card title="Attribution" endpoint="GET /cases/{case_id}/graph/path">
              {props.path ? (
                <Kv rows={[
                  ["Subject", <span className="mono">{shortAddr(props.path.subject)}</span>],
                  ["Terminal", <span className="mono" title={props.path.terminal}>{shortAddr(props.path.terminal)}</span>],
                  ["Terminal reason", summary?.terminal_reason ? <span style={{ textTransform: "capitalize" }}>{summary.terminal_reason.replace(/-/g, " ")}</span> : "—"],
                  ["Hops", String(props.path.hops.length)],
                ]} />
              ) : (
                <Empty title="No traced path yet" hint="Run a trace from the button above; the subject → terminal trail appears here." />
              )}
            </Card>
          </div>
          <div>
            <Card title="Scores" endpoint="GET /cases/{case_id}/latest">
              {summary ? (
                <Kv rows={[
                  ["Risk", summary.risk_score === null || summary.risk_score === undefined
                    ? "—"
                    : `${summary.risk_score}${summary.risk_level ? ` (${summary.risk_level})` : ""}`],
                  ["Confidence", summary.confidence === null || summary.confidence === undefined
                    ? "—" : summary.confidence.toFixed(2)],
                  ["Hops", summary.hop_count === null || summary.hop_count === undefined ? "—" : String(summary.hop_count)],
                  ["Webhook", summary.webhook_status ? <span style={{ textTransform: "capitalize" }}>{summary.webhook_status}</span> : "—"],
                ]} />
              ) : (
                <Empty title="No scores yet" hint="Scores appear once a trace completes for this case." />
              )}
            </Card>
            <Card title="Report & certificate" endpoint="GET /cases/{case_id}/latest">
              {summary && cert ? (
                <>
                  <Kv rows={[
                    ["Report hash", <span className="mono" title={cert.report_hash} style={{ fontSize: 11 }}>{shortAddr(cert.report_hash)}</span>],
                    ["Inputs hash", <span className="mono" title={cert.inputs_hash} style={{ fontSize: 11 }}>{shortAddr(cert.inputs_hash)}</span>],
                    ["Engine", <span className="mono">{cert.engine_version}</span>],
                    ["Generated", fmtDate(cert.generated_at)],
                  ]} />
                  <div style={{ marginTop: 12 }}>
                    <Link href={`/reports/${summary.report_id}`} className="btn-secondary">Open full report</Link>
                  </div>
                </>
              ) : (
                <Empty title="No report yet" hint="The report and its SHA-256 certificate appear once a trace completes." />
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "path" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40 }}>
          <div>
            <Card title="Attribution path" endpoint="GET /cases/{case_id}/graph/path" wide>
              {props.path ? (
                <>
                  <p style={{ fontSize: 12, color: "var(--tertiary)", margin: "0 0 16px" }}>
                    Subject {shortAddr(props.path.subject)} → terminal {shortAddr(props.path.terminal)} · {props.path.hops.length} hops
                  </p>
                  <PathHops hops={props.path.hops} />
                </>
              ) : (
                <Empty title="No traced path yet" hint="Run a trace from the button above." />
              )}
            </Card>
          </div>
          <div>
            <Card title="Cross-case links" endpoint="GET /cases/{case_id}/links">
              {props.links && props.links.links.length ? (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {props.links.links.map((l) => (
                    <li key={l.case_id} style={{ padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                      <div className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{l.case_id}</div>
                      <div style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 4 }}>
                        {l.overlap} shared address{l.overlap === 1 ? "" : "es"}
                        {l.shared_tags.length ? ` · tags: ${l.shared_tags.join(", ")}` : ""}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="No cross-case links" hint="Links are computed from the traced graph store." />
              )}
            </Card>
            {props.infraTag ? (
              <Card title="Shared infrastructure" endpoint="GET /intel/infrastructure/{tag}">
                {props.infra ? (
                  <Kv rows={[
                    ["Tag", <span className="mono">{props.infra.tag}</span>],
                    ["Addresses", String(props.infra.address_count)],
                  ]} />
                ) : (
                  <Empty title="Pivot returned nothing" hint={`No infrastructure recorded under tag ${props.infraTag}.`} />
                )}
              </Card>
            ) : null}
          </div>
        </div>
      )}

      {tab === "filings" && (
        <Card title="Filings for this case" endpoint="GET /filings?case_id={case_id}" wide>
          {props.filings === null ? (
            <Empty title="Could not load filings" hint="The filings API did not respond." />
          ) : props.filings.length ? (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Filing</th><th>Status</th><th>Attempts</th><th>Filed</th><th>Error</th>
                  <th className="cell-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {props.filings.map((f) => (
                  <tr key={f.filing_id}>
                    <td className="t-ink mono" title={f.filing_id}>{f.filing_id.slice(0, 8)}</td>
                    <td style={{ textTransform: "capitalize" }}>{f.status}</td>
                    <td className="t-num">{f.attempts}</td>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(f.filed_at)}</td>
                    <td style={{ fontSize: 11, color: "var(--tertiary)", maxWidth: 260, overflow: "hidden", textOverflow: "ellipsis" }}
                      title={f.error ?? ""}>
                      {f.error || "—"}
                    </td>
                    <td className="cell-end">
                      <Link href={`/filings/${f.filing_id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty title="No filings for this case" hint="A filing is recorded each time an attribution package is delivered to SAHYOG." />
          )}
        </Card>
      )}

      {tab === "feedback" && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40 }}>
          <div>
            <Card title="Outcome feedback" endpoint="POST /feedback/outcomes">
              {props.saved ? <p style={{ fontSize: 12, color: "var(--ok-text)", margin: "0 0 12px" }}>Outcome recorded.</p> : null}
              {props.formError ? <p style={{ fontSize: 12, color: "var(--signal)", margin: "0 0 12px" }}>Could not record outcome ({props.formError}).</p> : null}
              <form action={props.submitOutcome}>
                <input type="hidden" name="case_id" value={caseRec.case_id} />
                <div className="section-label" style={{ marginBottom: 8 }}>Disposition</div>
                <label style={radioRow}><input type="radio" name="outcome" value="confirmed" defaultChecked /> Confirmed</label>
                <label style={radioRow}><input type="radio" name="outcome" value="refuted" /> False positive</label>
                <label style={radioRow}><input type="radio" name="outcome" value="inconclusive" /> Inconclusive</label>
                <div style={{ marginTop: 16, marginBottom: 12 }}>
                  <label className="section-label" htmlFor="fb-vasp" style={{ display: "block", marginBottom: 6 }}>VASP (as attributed)</label>
                  <input id="fb-vasp" name="vasp" required className="search-input" style={{ width: "100%" }} placeholder="VASP name" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="section-label" htmlFor="fb-conf" style={{ display: "block", marginBottom: 6 }}>Predicted confidence (0–1)</label>
                  <input id="fb-conf" name="predicted_confidence" type="number" min="0" max="1" step="0.01" required className="search-input" style={{ width: 160 }} placeholder="0.78" />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label className="section-label" htmlFor="fb-note" style={{ display: "block", marginBottom: 6 }}>Note</label>
                  <textarea id="fb-note" name="notes" rows={3} className="search-input" style={{ width: "100%", height: "auto", padding: "8px 12px" }} placeholder="Optional analyst note" />
                </div>
                <button type="submit" className="btn-primary">Submit</button>
              </form>
            </Card>
          </div>
          <div>
            <Card title="Recorded outcomes" endpoint="GET /feedback/outcomes">
              {props.outcomes === null ? (
                <Empty title="Could not load outcomes" hint="The feedback API did not respond." />
              ) : props.outcomes.length ? (
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {props.outcomes.map((o) => (
                    <li key={o.outcome_id} style={{ padding: "10px 0", borderBottom: "1px solid var(--hairline)" }}>
                      <div style={{ fontSize: 12, fontWeight: 500, textTransform: "capitalize" }}>{o.outcome}</div>
                      <div style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 4 }}>
                        {o.vasp} · predicted {o.predicted_confidence} · {fmtDate(o.created_at)}
                      </div>
                      {o.notes ? <div style={{ fontSize: 12, color: "var(--body)", marginTop: 4 }}>{o.notes}</div> : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <Empty title="No outcomes recorded for this case" />
              )}
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
