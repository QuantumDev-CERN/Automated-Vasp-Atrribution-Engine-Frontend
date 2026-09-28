import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { Forbidden, PageError } from "@/components/state";
import { createUser } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/server";

const ROLES = ["viewer", "analyst", "auditor", "admin"];

async function create(formData: FormData) {
  "use server";
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "");
  const jurisdictions = String(formData.get("jurisdictions") ?? "IN")
    .split(",").map((s) => s.trim()).filter(Boolean);
  if (!name || !ROLES.includes(role)) redirect("/admin/users/new?error=missing");
  try {
    const res = await createUser({ name, role, jurisdictions });
    redirect(`/admin/users/new?created=${encodeURIComponent(res.user_id)}&key=${encodeURIComponent(res.api_key)}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) redirect("/admin/users/new?error=forbidden");
    const msg = err instanceof ApiError ? `api-${err.status}` : "failed";
    redirect(`/admin/users/new?error=${encodeURIComponent(msg)}`);
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
 * New user — POST /admin/users. The raw API key is returned exactly once;
 * the success panel shows it with a store-it-now warning.
 */
export default async function NewUserPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; created?: string; key?: string }>;
}) {
  const { error, created, key } = await searchParams;

  return (
    <Chrome crumb="Admin › New user">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <p className="crumb">Admin › Users › New user</p>
            <h1 className="page-title">New user</h1>
            <p className="page-sub">Creates an API key for a new analyst or auditor</p>
          </div>
          <span className="endpoint-chip">POST /admin/users</span>
        </div>
      </div>

      {error === "forbidden" ? (
        <Forbidden endpoint="POST /admin/users" />
      ) : error ? (
        <div style={{ marginBottom: 20, maxWidth: 480 }}>
          <PageError title="User was not created" error={new Error(`Submission failed (${error}).`)} />
        </div>
      ) : null}

      {created && key ? (
        <div style={{ maxWidth: 560, marginBottom: 32 }}>
          <p style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", marginBottom: 8 }}>User created</p>
          <p className="mono" style={{ fontSize: 13, background: "var(--panel)", border: "1px solid var(--hairline)", borderRadius: 6, padding: "12px 14px", wordBreak: "break-all" }}>
            {key}
          </p>
          <p style={{ fontSize: 12, color: "var(--signal)", marginTop: 8 }}>
            Store this key now — it is never shown again. It authenticates as X-API-Key.
          </p>
          <Link href="/admin/users" className="btn-secondary" style={{ marginTop: 16, display: "inline-block" }}>Back to users</Link>
        </div>
      ) : (
        <form action={create}>
          <div style={field}>
            <label style={label} htmlFor="name">Name *</label>
            <input id="name" name="name" style={input} required placeholder="e.g. analyst-3" />
          </div>
          <div style={field}>
            <label style={label} htmlFor="role">Role *</label>
            <select id="role" name="role" style={input} required defaultValue="">
              <option value="" disabled>Select role</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div style={field}>
            <label style={label} htmlFor="jurisdictions">Jurisdictions</label>
            <input id="jurisdictions" name="jurisdictions" style={input} defaultValue="IN" placeholder="Comma separated, e.g. IN, US" />
          </div>
          <button type="submit" className="btn-primary">Create user</button>
        </form>
      )}
    </Chrome>
  );
}
