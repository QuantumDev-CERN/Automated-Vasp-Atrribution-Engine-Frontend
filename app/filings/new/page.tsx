import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { PageError } from "@/components/state";
import { sahyog } from "@/lib/api/server";
import { ApiError } from "@/lib/api/server";

const CHAINS = ["ethereum", "bitcoin", "tron", "solana", "bsc"];

async function submitFiling(formData: FormData) {
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
    redirect("/filings/new?error=missing");
  }
  try {
    const res = await sahyog.post<{ case_id: string; status: string }>("/sahyog/cases", payload);
    redirect(`/filings/${encodeURIComponent(res.case_id)}`);
  } catch (err) {
    const msg = err instanceof ApiError ? (err.status === 0 ? "mock-unreachable" : `api-${err.status}`) : "failed";
    redirect(`/filings/new?error=${encodeURIComponent(msg)}`);
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

/**
 * New filing — submits the case to the SAHYOG mock (:8091 POST /sahyog/cases).
 * The mock is in-memory; filings do not persist across restarts.
 */
export default async function NewFilingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return (
    <Chrome crumb="Filings › New filing">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <p className="crumb">Filings › New filing</p>
            <h1 className="page-title">New filing</h1>
            <p className="page-sub">Submits the case to the SAHYOG mock on :8091</p>
          </div>
          <span className="endpoint-chip">:8091 POST /sahyog/cases</span>
        </div>
      </div>
      {error ? (
        <div style={{ marginBottom: 20, maxWidth: 480 }}>
          <PageError
            title="Filing was not submitted"
            error={new Error(error === "mock-unreachable" ? "The SAHYOG mock is not reachable on :8091." : `Submission failed (${error}).`)}
          />
        </div>
      ) : null}
      <form action={submitFiling}>
        <div style={field}>
          <label style={label} htmlFor="fir_number">FIR number *</label>
          <input id="fir_number" name="fir_number" style={input} required placeholder="e.g. FIR/2026/0917" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="suspect_address">Suspect address *</label>
          <input id="suspect_address" name="suspect_address" style={input} required className="mono" />
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
          <input id="jurisdiction" name="jurisdiction" style={input} placeholder="Optional" />
        </div>
        <div style={field}>
          <label style={label} htmlFor="notes">Notes</label>
          <textarea id="notes" name="notes" rows={4} style={{ ...input, height: "auto", padding: "10px 12px" }} placeholder="Optional filing notes" />
        </div>
        <button type="submit" className="btn-primary">Submit filing</button>
      </form>
    </Chrome>
  );
}
