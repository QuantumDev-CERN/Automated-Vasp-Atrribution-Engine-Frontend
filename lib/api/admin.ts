import { vasp } from "./server";

/** Admin: users + audit trail — /admin (M12). */
export type ApiUser = {
  user_id: string;
  name: string;
  role: string;
  jurisdictions: string[];
  active: boolean;
  created_at: string;
};

export type AuditEvent = {
  event_id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  jurisdiction: string | null;
  ip: string | null;
  outcome: string;
  created_at: string;
};

export function listUsers() {
  return vasp.get<{ users: ApiUser[] }>("/admin/users");
}

export function createUser(payload: { name: string; role: string; jurisdictions?: string[] }) {
  return vasp.post<ApiUser & { api_key: string; warning: string }>("/admin/users", payload);
}

export function revokeUser(userId: string) {
  return vasp.del<{ user_id: string; revoked: boolean }>(`/admin/users/${userId}`);
}

export function queryAudit(opts: { limit?: number; user_id?: string; action?: string } = {}) {
  const q = new URLSearchParams();
  if (opts.limit) q.set("limit", String(opts.limit));
  if (opts.user_id) q.set("user_id", opts.user_id);
  if (opts.action) q.set("action", opts.action);
  const qs = q.toString();
  return vasp.get<{ events: AuditEvent[] }>(`/admin/audit${qs ? `?${qs}` : ""}`);
}
