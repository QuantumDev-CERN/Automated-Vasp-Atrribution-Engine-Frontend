"use client";

import { useState } from "react";
import { PathHops } from "@/components/workbench/PathHops";
import { Empty, Unavailable } from "@/components/state";
import { shortAddr, fmtDate } from "@/lib/format";
import type { CaseRec } from "@/lib/api/cases";
import type { GraphPath, CaseLinks, InfraPivot } from "@/lib/api/graph";
import type { Outcome } from "@/lib/api/feedback";

const TABS = ["overview", "path", "filings", "feedback"] as const;
type Tab = (typeof TABS)[number];

type Props = {
  initialTab: string;
  caseRec: CaseRec;
  path: GraphPath | null;
  links: CaseLinks | null;
  infra: InfraPivot | null;
  infraTag: string | null;
  outcomes: Outcome[] | null;
  filing: Record<string, unknown> | null;
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
  const { caseRec } = props;

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
                  ["Hops", String(props.path.hops.length)],
                ]} />
              ) : (
                <Empty title="No traced path yet" hint="Run a trace from the button above; the subject → terminal trail appears here." />
              )}
              <div style={{ marginTop: 16 }}>
                <Unavailable endpoint="GET /cases/{case_id}/latest" what="Mixer correlation, threat intel, instrument routing and scores" />
              </div>
            </Card>
          </div>
          <div>
            <Card title="Scores">
              <Unavailable endpoint="GET /cases/{case_id}/latest" what="Confidence and risk scores" />
            </Card>
            <Card title="Report & certificate">
              <Unavailable endpoint="GET /cases/{case_id}/latest" what="Report reference, SHA-256 and coverage" />
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
        <Card title="Filings for this case" endpoint=":8091 GET /sahyog/cases/{case_id}" wide>
          {props.filing ? (
            <Kv rows={Object.entries(props.filing).map(([k, v]) => [k, <span className="mono" key={k}>{String(v)}</span>] as [string, React.ReactNode])} />
          ) : (
            <Empty title="No filing in the SAHYOG mock for this case" hint="The mock only holds cases submitted through it in this session. The durable registry needs GET /filings (see docs/BACKEND-NEEDS.md)." />
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
                  <input id="fb-vasp" name="vasp" required className="search-input" style={{ width: "100%" }} placeholder="e.g. ChangeNOW" />
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
