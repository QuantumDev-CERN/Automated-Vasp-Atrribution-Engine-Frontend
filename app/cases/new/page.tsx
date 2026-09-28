import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { PageError } from "@/components/state";
import { submitCase } from "@/lib/api/cases";
import { ApiError } from "@/lib/api/server";

import { CHAINS } from "@/lib/chains";

async function createCase(formData: FormData) {
  "use server";
  const payload = {
    fir_number: String(formData.get("fir_number") ?? "").trim(),
    suspect_address: String(formData.get("suspect_address") ?? "").trim(),
    chain: String(formData.get("chain") ?? "").trim(),
    officer_id: String(formData.get("officer_id") ?? "").trim() || undefined,
    notes: String(formData.get("notes") ?? "").trim() || undefined,
    jurisdiction: String(formData.get("jurisdiction") ?? "").trim() || undefined,
  };
  if (!payload.fir_number || !payload.suspect_address || !payload.chain) {
    redirect("/cases/new?error=missing");
  }
  try {
    const res = await submitCase(payload);
    redirect(`/cases/${encodeURIComponent(res.case_id)}`);
  } catch (err) {
    const msg = err instanceof ApiError ? `api-${err.status}` : "failed";
    redirect(`/cases/new?error=${encodeURIComponent(msg)}`);
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

/** Register a new case — POST /cases. No field is prefilled; nothing invented. */
export default async function NewCasePage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Chrome crumb="Cases › New case">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <p className="crumb">Cases › New case</p>
            <h1 className="page-title">New case</h1>
            <p className="page-sub">Registers the subject wallet for tracing</p>
          </div>
          <span className="endpoint-chip">POST /cases</span>
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 20, maxWidth: 480 }}>
          <PageError title="Case was not registered" error={new Error(`Submission failed (${error}). Check the engine is reachable and the address/chain are valid.`)} />
        </div>
      ) : null}

      <form action={createCase}>
        <div style={field}>
          <label style={label} htmlFor="fir_number">FIR number *</label>
          <input id="fir_number" name="fir_number" style={input} required placeholder="FIR number" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="suspect_address">Suspect address *</label>
          <input id="suspect_address" name="suspect_address" style={input} required className="mono" placeholder="0x… / bc1… / T… / 5H…" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="chain">Chain *</label>
          <select id="chain" name="chain" style={input} required defaultValue="">
            <option value="" disabled>Select chain</option>
            {CHAINS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={field}>
          <label style={label} htmlFor="officer_id">Officer ID</label>
          <input id="officer_id" name="officer_id" style={input} placeholder="Optional" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="jurisdiction">Jurisdiction</label>
          <input id="jurisdiction" name="jurisdiction" style={input} placeholder="Optional, e.g. IN" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={4} style={{ ...input, height: "auto", padding: "10px 12px" }} placeholder="Optional case notes" />
        </div>
        <button type="submit" className="btn-primary">Register case</button>
      </form>
    </Chrome>
  );
}
