"use client";

import clsx from "clsx";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  CircleAlert,
  Receipt,
  RotateCcw,
  Sparkles,
  TriangleAlert,
  Undo2,
  Wallet,
} from "lucide-react";
import { formatDate, formatSignedInr } from "@/lib/format";
import type { LedgerItem, MerchantAlert } from "@/lib/types";
import { Chip } from "./Chip";
import { useSaathi } from "./SaathiDock";
import { Button } from "./ui/primitives";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-navy">{title}</h1>
        {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
      </div>
      {action}
    </header>
  );
}

export function AskSaathiButton({ text, label = "Resolve with Saathi", variant = "primary" }: { text: string; label?: string; variant?: "primary" | "secondary" }) {
  const { ask } = useSaathi();
  return (
    <Button variant={variant} onClick={() => ask(text)}>
      <Sparkles className="size-4" aria-hidden /> {label}
    </Button>
  );
}

export function AlertCard({ alert }: { alert: MerchantAlert }) {
  const critical = alert.severity === "critical";
  const Icon = critical ? CircleAlert : TriangleAlert;
  return (
    <div role="alert" className={clsx("flex flex-wrap items-center gap-4 rounded-xl border p-4", critical ? "border-danger/30 bg-danger/5" : "border-warn/30 bg-warn/5")}>
      <Icon className={clsx("size-6 shrink-0", critical ? "text-danger" : "text-warn")} aria-hidden />
      <div className="min-w-[14rem] flex-1">
        <p className="font-semibold text-ink">{alert.title}</p>
        <p className="text-sm text-muted">{alert.body}</p>
      </div>
      <AskSaathiButton text={alert.ask} />
    </div>
  );
}

const ICON: Record<LedgerItem["kind"], { icon: typeof Wallet; cls: string }> = {
  payment_received: { icon: ArrowDownLeft, cls: "bg-success/10 text-success" },
  settlement: { icon: Banknote, cls: "bg-navy-2/10 text-navy-2" },
  rent_charge: { icon: ArrowUpRight, cls: "bg-surface text-muted" },
  rent_reversal: { icon: RotateCcw, cls: "bg-success/10 text-success" },
  bill_payment: { icon: Receipt, cls: "bg-surface text-muted" },
  refund: { icon: Undo2, cls: "bg-success/10 text-success" },
};

export function LedgerRow({ item }: { item: LedgerItem }) {
  const { icon: Icon, cls } = ICON[item.kind];
  const amount = Number(item.amount_inr);
  const flag = item.kind === "settlement" ? item.status : item.kind === "bill_payment" && item.status !== "SUCCESS" ? item.status : item.kind === "refund" ? item.status : null;
  return (
    <li className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
      <span className={clsx("flex size-9 shrink-0 items-center justify-center rounded-full", cls)}>
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{item.title}</span>
          {flag && <Chip status={flag} />}
        </span>
        <span className="block truncate text-xs text-muted">
          {item.subtitle}
          {item.reference ? ` · ${item.reference}` : ""} · {formatDate(item.ts, true)}
        </span>
      </span>
      <span className={clsx("shrink-0 text-sm font-semibold tabular-nums", amount > 0 ? "text-success" : "text-ink")}>{formatSignedInr(item.amount_inr)}</span>
    </li>
  );
}
