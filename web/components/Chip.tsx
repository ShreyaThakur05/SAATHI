import { Badge } from "./ui/primitives";

type Tone = "neutral" | "success" | "warn" | "danger" | "info" | "dark";

const MAP: Record<string, { label: string; tone: Tone }> = {
  ONLINE: { label: "Online", tone: "success" },
  OFFLINE: { label: "Offline", tone: "danger" },
  PAID: { label: "Paid out", tone: "success" },
  RELEASED: { label: "Released", tone: "success" },
  HELD: { label: "On hold", tone: "warn" },
  SUCCESS: { label: "Successful", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
  FAILURE: { label: "Failed", tone: "danger" },
  PENDING: { label: "Pending", tone: "warn" },
  VERIFIED: { label: "Verified", tone: "success" },
  MISSING: { label: "Needed", tone: "warn" },
  MISMATCH: { label: "Mismatch", tone: "danger" },
  CREATED: { label: "Order placed", tone: "info" },
};

export function Chip({ status, label }: { status: string; label?: string }) {
  const m = MAP[status] ?? { label: status, tone: "neutral" as Tone };
  return <Badge tone={m.tone}>{label ?? m.label}</Badge>;
}
