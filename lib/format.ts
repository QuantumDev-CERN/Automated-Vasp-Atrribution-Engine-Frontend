/** Display formatting. Never invents data; only shapes what the API returned. */

export function shortAddr(addr: string | null | undefined): string {
  if (!addr) return "—";
  return addr.length > 14 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : addr;
}

const dtf = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Kolkata",
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${dtf.format(d)} IST`;
}

export function fmtNum(n: number | null | undefined): string {
  return n === null || n === undefined ? "—" : n.toLocaleString("en-IN");
}

export function pct(x: number | null | undefined): string {
  return x === null || x === undefined ? "—" : `${(x * 100).toFixed(1)}%`;
}
