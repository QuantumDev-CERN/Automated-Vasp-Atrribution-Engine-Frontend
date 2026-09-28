import Link from "next/link";
import { Chrome } from "@/components/chrome/Chrome";
import { Forbidden, PageError } from "@/components/state";
import { AuditTable } from "@/components/admin/AuditTable";
import { queryAudit } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/server";

export default async function AuditPage() {
  let events;
  try {
    events = (await queryAudit({ limit: 1000 })).events;
  } catch (err) {
    if (err instanceof ApiError && err.status === 403) {
      return (
        <Chrome crumb="Admin › Audit trail">
          <Forbidden endpoint="GET /admin/audit" />
        </Chrome>
      );
    }
    return (
      <Chrome crumb="Admin › Audit trail">
        <PageError title="Could not load audit trail" error={err} />
      </Chrome>
    );
  }

  return (
    <Chrome crumb="Admin › Audit trail">
      <div className="page-head">
        <div className="page-head-row">
          <div>
            <h1 className="page-title">Audit trail</h1>
            <p className="page-sub">{events.length} events · RBAC</p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span className="endpoint-chip">POST /admin/users</span>
            <span className="endpoint-chip">GET /admin/audit</span>
            <Link href="/admin/users" className="btn-secondary">Users</Link>
            <Link href="/admin/users/new" className="btn-primary">+ New user</Link>
          </div>
        </div>
      </div>
      <AuditTable events={events} />
    </Chrome>
  );
}
