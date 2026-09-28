import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { Unavailable } from "@/components/state";

async function openCase(formData: FormData) {
  "use server";
  const id = String(formData.get("case_id") ?? "").trim();
  if (id) redirect(`/cases/${encodeURIComponent(id)}`);
}

/**
 * Cases list. The engine has no GET /cases collection route, so the
 * register table cannot be populated — the page stays useful via
 * case registration and direct lookup instead of invented rows.
 */
export default function CasesPage() {
  return (
    <Chrome crumb="Cases">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Cases</h1>
            <p className="page-sub">Cases registered in the engine</p>
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
      <Unavailable endpoint="GET /cases" what="Case register" />
    </Chrome>
  );
}
