import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { PageError, Empty } from "@/components/state";
import { getCaseLinks, getRankedIntel } from "@/lib/api/graph";
import { getCalibration } from "@/lib/api/feedback";
import { ApiError } from "@/lib/api/server";
import { shortAddr } from "@/lib/format";

async function openIntel(formData: FormData) {
  "use server";
  const id = String(formData.get("case_id") ?? "").trim();
  if (id) redirect(`/intel?case=${encodeURIComponent(id)}`);
}

/** Humanize a backend tag into the relationship line, e.g. "mixer-deposit" -> "Shared mixer deposit". */
function relationship(tags: string[]): string {
  if (!tags.length) return "Shared addresses";
  const t = tags[0].replace(/[-_]/g, " ");
  return `Shared ${t}`;
}

export default async function IntelPage({ searchParams }: { searchParams: Promise<{ case?: string }> }) {
  const { case: caseIdRaw } = await searchParams;
  const caseId = (caseIdRaw ?? "").trim();
  const [calibrationR, rankedR] = await Promise.allSettled([
    getCalibration(),
    getRankedIntel(50),
  ]);
  const calibration = calibrationR.status === "fulfilled" ? calibrationR.value : null;
  const ranked = rankedR.status === "fulfilled" ? rankedR.value : null;
  const rankedError = rankedR.status === "rejected" ? rankedR.reason : null;

  return (
    <Chrome crumb="Intelligence">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Intelligence</h1>
            <p className="page-sub">Cross-case graph intersections{caseId ? ` for ${caseId}` : ""}</p>
          </div>
          <span className="endpoint-chip">GET /feedback/calibration</span>
        </div>
      </div>

      {!caseId ? (
        <form action={openIntel} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 32 }}>
          <input name="case_id" className="search-input" style={{ minWidth: 320 }} placeholder="Case ID" required />
          <button type="submit" className="btn-secondary">Show links</button>
          <span className="endpoint-chip">GET /cases/{`{case_id}`}/links</span>
        </form>
      ) : (
        <IntelLinks caseId={caseId} />
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 40, marginTop: 32 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">
              Ranked intelligence feed{ranked ? ` · ${ranked.total_tags} tags` : ""}
            </span>
            <span className="endpoint-chip">GET /intel/links/ranked</span>
          </div>
          {ranked ? (
            ranked.ranked.length ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tag</th><th>Addresses</th><th>Cases</th><th>Sample addresses</th><th>Linked cases</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.ranked.map((e) => (
                    <tr key={e.tag}>
                      <td className="t-ink mono">{e.tag}</td>
                      <td className="t-num">{e.address_count}</td>
                      <td className="t-num">{e.case_count}</td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {e.addresses.slice(0, 3).map((a) => (
                          <div key={`${a.chain}:${a.address}`} title={a.address}>
                            {shortAddr(a.address)} <span style={{ color: "var(--tertiary)" }}>{a.chain}</span>
                          </div>
                        ))}
                      </td>
                      <td className="mono" style={{ fontSize: 11 }}>
                        {e.cases.slice(0, 3).map((c) => (
                          <div key={c}>
                            <Link href={`/cases/${c}`}>{c.slice(0, 8)}</Link>
                          </div>
                        ))}
                        {e.cases.length === 0 ? "—" : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Empty title="No intelligence tags yet" hint="Tags appear here once the engine traces cases and annotates addresses." />
            )
          ) : (
            <PageError title="Could not load ranked intelligence feed" error={rankedError} />
          )}
          <p style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 8 }}>
            Only tags assigned by the engine itself are listed — nothing is invented to fill this feed.
          </p>
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <span className="section-label">Model calibration</span>
            <span className="endpoint-chip">GET /feedback/calibration</span>
          </div>
          {calibration ? (
            calibration.model ? (
              <dl className="kv" style={{ gridTemplateColumns: "140px 1fr" }}>
                {Object.entries(calibration.model).slice(0, 8).map(([k, v]) => (
                  <div className="kv-row" key={k}>
                    <dt>{k.replace(/_/g, " ")}</dt>
                    <dd className="mono" style={{ fontSize: 11, wordBreak: "break-all" }}>
                      {typeof v === "object" ? JSON.stringify(v).slice(0, 120) : String(v)}
                    </dd>
                  </div>
                ))}
              </dl>
            ) : (
              <Empty title="No calibration fitted yet" hint={calibration.note ?? "The raw confidence model is used unchanged."} />
            )
          ) : (
            <Empty title="Calibration unavailable" hint="The feedback API did not respond." />
          )}
        </div>
      </div>
    </Chrome>
  );
}

async function IntelLinks({ caseId }: { caseId: string }) {
  let links;
  try {
    links = await getCaseLinks(caseId);
  } catch (err) {
    return (
      <div style={{ marginBottom: 8 }}>
        <PageError title={`Could not load cross-case links for ${caseId}`} error={err} />
      </div>
    );
  }
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span className="section-label">Cross-case links · {links.links.length} of {links.links.length}</span>
        <span className="endpoint-chip">GET /cases/{`{case_id}`}/links</span>
      </div>
      {links.links.length ? (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Case</th><th>Relationship</th><th>Shared addresses</th><th>Tags</th><th className="cell-end">Action</th>
              </tr>
            </thead>
            <tbody>
              {links.links.map((l) => (
                <tr key={l.case_id}>
                  <td className="t-ink mono">{l.case_id}</td>
                  <td className="t-ink">{relationship(l.shared_tags)}</td>
                  <td className="t-num">{l.overlap}</td>
                  <td style={{ fontSize: 12, color: "var(--tertiary)" }}>
                    {l.shared_tags.length ? l.shared_tags.slice(0, 3).join(", ") : "—"}
                  </td>
                  <td className="cell-end">
                    <Link href={`/cases/${l.case_id}`}>View</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 8 }}>
            Link strength scores need backend support — see docs/BACKEND-NEEDS.md.
          </p>
        </>
      ) : (
        <Empty title="No cross-case links" hint="No other case shares addresses with this case's graph." />
      )}
    </div>
  );
}
