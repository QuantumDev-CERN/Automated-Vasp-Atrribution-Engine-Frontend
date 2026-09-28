import { Clock } from "./Clock";
import { getCurrentUserLabel } from "@/lib/api/server";

/**
 * Top bar: app mark + name | centered breadcrumb | PROD · operator · clock.
 * The operator chip renders only when the backend can tell us who the
 * API key belongs to (GET /admin/users/me — see docs/BACKEND-NEEDS.md).
 * Until then the slot stays empty; we never invent a name.
 */
export async function TopBar({ crumb }: { crumb: string }) {
  const operator = await getCurrentUserLabel().catch(() => null);
  return (
    <header className="topbar">
      <div className="topbar-brand">
        <span className="app-mark">V</span>
        <span className="app-name">VASP Attribution Engine</span>
      </div>
      <div className="topbar-crumb">{crumb}</div>
      <div className="topbar-right">
        <span className="env-tag">PROD</span>
        {operator ? <span className="user-chip">{operator}</span> : null}
        <Clock />
      </div>
    </header>
  );
}
