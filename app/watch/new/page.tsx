import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { PageError } from "@/components/state";
import { addWatch } from "@/lib/api/watchlist";
import { ApiError } from "@/lib/api/server";

import { CHAINS } from "@/lib/chains";

async function createWatch(formData: FormData) {
  "use server";
  const payload = {
    address: String(formData.get("address") ?? "").trim(),
    chain: String(formData.get("chain") ?? "").trim(),
    label: String(formData.get("label") ?? "").trim() || undefined,
    case_id: String(formData.get("case_id") ?? "").trim() || undefined,
    alert_url: String(formData.get("alert_url") ?? "").trim() || undefined,
    created_by: String(formData.get("created_by") ?? "").trim() || undefined,
  };
  if (!payload.address || !payload.chain) redirect("/watch/new?error=missing");
  try {
    const res = await addWatch(payload);
    redirect(`/watch/${encodeURIComponent(res.watch_id)}`);
  } catch (err) {
    const msg = err instanceof ApiError ? `api-${err.status}` : "failed";
    redirect(`/watch/new?error=${encodeURIComponent(msg)}`);
  }
}

const field: React.CSSProperties = { marginBottom: 16 };
const label: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 500, textTransform: "uppercase",
  letterSpacing: "0.08em", color: "var(--tertiary)", marginBottom: 6,
};
const input: React.CSSProperties = {
  width: "100%", maxWidth: 480, height: 34, border: "1px solid var(--hairline)",
  borderRadius: 6, padding: "0 12px", fontSize: 13, fontFamily: "inherit",
  background: "var(--panel)", color: "var(--ink)",
};

/** Subscribe an address for movement alerts — POST /watchlist. */
export default async function NewWatchPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Chrome crumb="Watchlist › New watch">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <p className="crumb">Watchlist › New watch</p>
            <h1 className="page-title">New watch</h1>
            <p className="page-sub">Monitor an address for new movements</p>
          </div>
          <span className="endpoint-chip">POST /watchlist</span>
        </div>
      </div>
      {error ? (
        <div style={{ marginBottom: 20, maxWidth: 480 }}>
          <PageError title="Watch was not created" error={new Error(`Submission failed (${error}).`)} />
        </div>
      ) : null}
      <form action={createWatch}>
        <div style={field}>
          <label style={label} htmlFor="address">Address *</label>
          <input id="address" name="address" style={input} required className="mono" placeholder="0x… / bc1… / T… / 5H…" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="chain">Chain *</label>
          <select id="chain" name="chain" style={input} required defaultValue="">
            <option value="" disabled>Select chain</option>
            {CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={field}>
          <label style={label} htmlFor="wlabel">Label</label>
          <input id="wlabel" name="label" style={input} placeholder="Optional label" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="case_id">Case ID</label>
          <input id="case_id" name="case_id" style={input} className="mono" placeholder="Optional link to a case" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="alert_url">Alert webhook URL</label>
          <input id="alert_url" name="alert_url" style={input} className="mono" placeholder="Optional — signed alerts POST here" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="created_by">Created by</label>
          <input id="created_by" name="created_by" style={input} placeholder="Optional analyst id" />
        </div>
        <button type="submit" className="btn-primary">Add watch</button>
      </form>
    </Chrome>
  );
}
