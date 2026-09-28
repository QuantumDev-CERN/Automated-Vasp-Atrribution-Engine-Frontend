import Link from "next/link";
import { redirect } from "next/navigation";
import { Chrome } from "@/components/chrome/Chrome";
import { Forbidden, PageError, Empty } from "@/components/state";
import { listUsers, revokeUser } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/server";
import { fmtDate } from "@/lib/format";

async function revoke(formData: FormData) {
  "use server";
  const userId = String(formData.get("user_id") ?? "");
  await revokeUser(userId);
  redirect("/admin/users");
}

export default async function UsersPage() {
  let users;
  try {
    users = (await listUsers()).users;
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <Chrome crumb="Admin › Users">
          <Forbidden endpoint="GET /admin/users" />
        </Chrome>
      );
    }
    return (
      <Chrome crumb="Admin › Users">
        <PageError title="Could not load users" error={err} />
      </Chrome>
    );
  }

  return (
    <Chrome crumb="Admin › Users">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <p className="crumb">Admin › Users</p>
            <h1 className="page-title">Users</h1>
            <p className="page-sub">{users.length} user{users.length === 1 ? "" : "s"}</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">GET /admin/users</span>
            <Link href="/admin/users/new" className="btn-primary">+ New user</Link>
          </div>
        </div>
      </div>
      {users.length ? (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th><th>Role</th><th>Jurisdictions</th><th>Status</th><th>Created</th><th className="cell-end">Action</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.user_id}>
                <td className="t-ink">{u.name}</td>
                <td style={{ textTransform: "capitalize" }}>{u.role}</td>
                <td>{u.jurisdictions.join(", ") || "—"}</td>
                <td style={{ color: u.active ? "var(--ok-text)" : "var(--tertiary)" }}>
                  {u.active ? "Active" : "Revoked"}
                </td>
                <td>{fmtDate(u.created_at)}</td>
                <td className="cell-end">
                  {u.active ? (
                    <form action={revoke} style={{ display: "inline" }}>
                      <input type="hidden" name="user_id" value={u.user_id} />
                      <button type="submit" style={{ background: "none", border: 0, color: "var(--signal)", fontSize: 12, cursor: "pointer", padding: 0 }}>
                        Revoke
                      </button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <Empty title="No users" hint="Create the first API user." />
      )}
      <p style={{ fontSize: 11, color: "var(--tertiary)", marginTop: 8 }}>
        Email and last-active columns need backend fields — see docs/BACKEND-NEEDS.md.
      </p>
    </Chrome>
  );
}
