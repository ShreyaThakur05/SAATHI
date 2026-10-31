import { Bot, UserRound } from "lucide-react";
import Link from "next/link";
import { humanize, relativeTime } from "@/lib/format";
import type { CaseSummary } from "@/lib/types";
import { StatusPill } from "./StatusPill";
import { Badge } from "./ui/primitives";

export function CaseRow({ c }: { c: CaseSummary }) {
  return (
    <Link
      href={`/console/cases/${c.id}`}
      className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 border-b border-line px-4 py-3 last:border-0 hover:bg-surface md:grid-cols-[4rem_1.2fr_1fr_auto_6rem]"
    >
      <span className="hidden text-sm font-mono text-muted md:block">#{c.id}</span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-ink">{c.summary}</span>
        <span className="block truncate text-xs text-muted">
          {c.merchant_name ?? `Merchant ${c.merchant_id}`}
          <span className="md:hidden"> · #{c.id}</span>
        </span>
      </span>
      <span className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1">
        <Badge>{humanize(c.product.toLowerCase())}</Badge>
        {c.injection_suspected && <Badge tone="danger">instruction</Badge>}
        <span className="flex items-center gap-1 text-xs text-muted">
          {c.handled_by_person ? <UserRound className="size-3.5" aria-hidden /> : <Bot className="size-3.5" aria-hidden />}
          {c.handled_by_person ? "person" : "Saathi"}
        </span>
      </span>
      <span className="row-start-1 col-start-2 justify-self-end md:row-auto md:col-auto">
        <StatusPill status={c.status} />
      </span>
      <span className="hidden text-right text-xs text-muted md:block">{relativeTime(c.created_at)}</span>
    </Link>
  );
}
