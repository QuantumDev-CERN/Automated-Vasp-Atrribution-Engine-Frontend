import { ApiError } from "@/lib/api/server";

/** Honest states: loading, empty, unavailable, error. Never mock data. */

export function PageError({ error, title = "Could not load this page" }: { error: unknown; title?: string }) {
  const detail =
    error instanceof ApiError
      ? error.status === 0
        ? `Engine unreachable at ${process.env.VASP_API_URL ?? "the configured VASP_API_URL"}. Start the backend and reload.`
        : `API returned ${error.status}. ${error.body}`
      : error instanceof Error
        ? error.message
        : String(error);
  return (
    <div className="error-state">
      <strong style={{ color: "var(--ink)", display: "block", marginBottom: 6 }}>{title}</strong>
      <span className="mono" style={{ fontSize: 11 }}>{detail}</span>
    </div>
  );
}

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}

/** A whole section the backend cannot populate yet. Names the missing endpoint. */
export function Unavailable({ endpoint, what }: { endpoint: string; what: string }) {
  return (
    <div className="empty-state">
      <strong>{what} unavailable</strong>
      <span>
        The backend does not expose <span className="mono">{endpoint}</span> yet — see{" "}
        <span className="mono">docs/BACKEND-NEEDS.md</span>. Nothing is shown here rather than
        invented data.
      </span>
    </div>
  );
}

/** Row-level skeleton while data loads. */
export function SkeletonRows({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <table className="data-table" aria-hidden>
      <tbody>
        {Array.from({ length: rows }).map((_, r) => (
          <tr key={r}>
            {Array.from({ length: cols }).map((_, c) => (
              <td key={c}>
                <div className="skeleton" style={{ height: 12, width: `${40 + ((r * 7 + c * 13) % 50)}%` }}>&nbsp;</div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
