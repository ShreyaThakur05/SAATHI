export function formatInr(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: n % 1 === 0 ? 0 : 2,
  }).format(n);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined) return "-";
  if (seconds < 1) return "<1s";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  if (seconds < 3600) return `${m}m ${Math.round(seconds % 60)}s`;
  return `${Math.floor(seconds / 3600)}h ${m % 60}m`;
}

export function formatPercent(rate: number | null | undefined): string {
  return rate === null || rate === undefined ? "-" : `${Math.round(rate * 100)}%`;
}

export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (diff < 10) return "just now";
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Elapsed clock like the deck's timeline: 0:02, 0:31, 1:05 */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const humanize = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** +₹20 / -₹300 for ledger lines */
export function formatSignedInr(value: string | number): string {
  const n = Number(value);
  if (Number.isNaN(n)) return "-";
  const body = formatInr(Math.abs(n));
  return n > 0 ? `+${body}` : n < 0 ? `-${body}` : body;
}

export function formatDate(iso: string, withTime = false): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}
