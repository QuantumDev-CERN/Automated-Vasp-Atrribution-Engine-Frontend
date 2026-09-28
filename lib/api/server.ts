/**
 * lib/api/server.ts — server-side API client for the VASP engine.
 *
 * SERVER ONLY. Never import from a client component: the API key lives
 * here and must never reach the browser. Client-initiated mutations go
 * through the /api/v1/* route handlers, which reuse this module.
 *
 * Every number or name the UI shows comes from one of these calls.
 * Nothing is hardcoded; nothing is mocked.
 */

const VASP_API_URL = (process.env.VASP_API_URL ?? "http://127.0.0.1:8000").replace(/\/$/, "");
const SAHYOG_MOCK_URL = (process.env.SAHYOG_MOCK_URL ?? "http://127.0.0.1:8091").replace(/\/$/, "");
const VASP_API_KEY = process.env.VASP_API_KEY ?? "";

export class ApiError extends Error {
  status: number;
  body: string;
  constructor(status: number, body: string, path: string) {
    super(`API ${status} on ${path}`);
    this.status = status;
    this.body = body;
  }
  get notFound() {
    return this.status === 404;
  }
}

type FetchOpts = {
  method?: string;
  body?: unknown;
  /** override fetch cache behaviour; ops console defaults to live */
  cache?: RequestCache;
};

async function call(base: string, path: string, opts: FetchOpts = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(base + path, {
      method: opts.method ?? "GET",
      headers: {
        "Content-Type": "application/json",
        ...(VASP_API_KEY ? { "X-API-Key": VASP_API_KEY } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
      cache: opts.cache ?? "no-store",
    });
  } catch (err) {
    throw new ApiError(0, `unreachable: ${err instanceof Error ? err.message : String(err)}`, path);
  }
  const text = await res.text();
  if (!res.ok) throw new ApiError(res.status, text.slice(0, 500), path);
  return text ? JSON.parse(text) : null;
}

/** Engine API (port 8000): cases, jobs, graph, reports, watchlist, admin, feedback. */
export const vasp = {
  get: <T>(path: string, opts?: FetchOpts) => call(VASP_API_URL, path, opts) as Promise<T>,
  post: <T>(path: string, body?: unknown) => call(VASP_API_URL, path, { method: "POST", body }) as Promise<T>,
  patch: <T>(path: string, body?: unknown) => call(VASP_API_URL, path, { method: "PATCH", body }) as Promise<T>,
  del: <T>(path: string) => call(VASP_API_URL, path, { method: "DELETE" }) as Promise<T>,
};

/** SAHYOG mock API (port 8091): webhook deliveries, watch alerts, case submissions. */
export const sahyog = {
  get: <T>(path: string, opts?: FetchOpts) => call(SAHYOG_MOCK_URL, path, opts) as Promise<T>,
  post: <T>(path: string, body?: unknown) => call(SAHYOG_MOCK_URL, path, { method: "POST", body }) as Promise<T>,
};

export function apiBaseUrl() {
  return VASP_API_URL;
}
export function sahyogBaseUrl() {
  return SAHYOG_MOCK_URL;
}

/**
 * Who does the configured API key belong to? Returns "Name · role" or null.
 * Needs GET /admin/users/me on the backend (docs/BACKEND-NEEDS.md); until
 * it exists this resolves null and the top-bar slot stays empty.
 */
export async function getCurrentUserLabel(): Promise<string | null> {
  try {
    const me = await vasp.get<{ name: string; role: string }>("/admin/users/me");
    if (me && me.name) return `${me.name} · ${me.role}`;
    return null;
  } catch {
    return null;
  }
}
