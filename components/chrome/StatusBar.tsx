import { Clock } from "./Clock";
import { getHealth, getReady } from "@/lib/api/health";
import { ApiError } from "@/lib/api/server";

type Svc = { name: string; up: boolean };

/**
 * Status bar: per-service dots derived from GET /health + GET /ready,
 * the /health endpoint chip, and the aggregate verdict.
 *
 * Mapping (honest, no invented services):
 *   api      -> /health answers at all
 *   worker   -> queue is initialized (/ready checks.queue)
 *   postgres -> store backend is Postgres (/ready checks.store)
 *   redis    -> queue backend is Redis (/ready checks.queue)
 *   neo4j    -> graph backend is Neo4j (/ready checks.graph)
 * A memory fallback reports its dot down: the service is not backing
 * the engine, and the UI must not pretend otherwise.
 */
async function readServices(): Promise<{ svcs: Svc[]; allUp: boolean; reachable: boolean }> {
  const names = ["api", "worker", "postgres", "redis", "neo4j"];
  try {
    const [health, ready] = await Promise.all([getHealth(), getReady()]);
    const c = ready.checks ?? {};
    // Exact backend class names: MemoryStore|PostgresStore, ArqQueue|MemoryQueue,
    // MemoryGraphStore|Neo4jGraphStore. A memory fallback means the named
    // service is not backing the engine, so its dot reads down.
    const svcs: Svc[] = [
      { name: "api", up: health.status === "ok" },
      { name: "worker", up: c.queue === "ArqQueue" },
      { name: "postgres", up: c.store === "PostgresStore" },
      { name: "redis", up: c.queue === "ArqQueue" },
      { name: "neo4j", up: c.graph === "Neo4jGraphStore" },
    ];
    return { svcs, allUp: svcs.every((s) => s.up), reachable: true };
  } catch (err) {
    if (err instanceof ApiError && err.status === 0) {
      return { svcs: names.map((name) => ({ name, up: false })), allUp: false, reachable: false };
    }
    throw err;
  }
}

export async function StatusBar() {
  const { svcs, allUp, reachable } = await readServices();
  return (
    <footer className="statusbar">
      {svcs.map((s) => (
        <span key={s.name} className="svc" title={s.up ? "up" : "down"}>
          <span className={"status-dot" + (s.up ? "" : " down")} />
          {s.name}
        </span>
      ))}
      <span className="endpoint-chip">GET /health</span>
      <span className="statusbar-right">
        <span>{!reachable ? "Engine unreachable" : allUp ? "All systems normal" : "Degraded — see /ready"}</span>
        <Clock seconds />
      </span>
    </footer>
  );
}
