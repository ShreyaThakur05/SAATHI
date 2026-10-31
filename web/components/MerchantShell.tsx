"use client";

import clsx from "clsx";
import { Activity, CreditCard, Home, LifeBuoy, LogOut, Receipt, Router } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { useMerchant, useMerchantQuery } from "@/lib/merchantAuth";
import { EnvBanner } from "./EnvBanner";
import { SaathiProvider } from "./SaathiDock";
import { ToastProvider, useToast } from "./Toaster";
import { Badge, Skeleton } from "./ui/primitives";

const NAV = [
  { href: "/app", label: "Overview", icon: Home },
  { href: "/app/devices", label: "Devices", icon: Router },
  { href: "/app/settlements", label: "Settlements", icon: CreditCard },
  { href: "/app/bills", label: "Bills and refunds", icon: Receipt },
  { href: "/app/transactions", label: "Transactions", icon: Activity },
  { href: "/app/help", label: "Help requests", icon: LifeBuoy },
];

const DONE_COPY: Record<string, string> = {
  RESOLVED: "Resolved and verified",
  AWAITING_APPROVAL: "Passed to our team",
  WAITING_MERCHANT: "Needs one thing from you",
  BLOCKED: "Could not be done",
  REJECTED: "Declined by our team",
};

/** Tells the merchant when a help request changes state, wherever they are in the dashboard. */
function useHelpToasts() {
  const toast = useToast();
  const q = useMerchantQuery(["help-requests"], (api) => api.helpRequests(), { refetchInterval: 3000 });
  const seen = useRef<Record<number, string> | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const prev = seen.current;
    seen.current = Object.fromEntries(q.data.map((r) => [r.id, r.status]));
    if (!prev) return; // first load: do not announce history
    for (const r of q.data) {
      if (prev[r.id] !== undefined && prev[r.id] !== r.status && DONE_COPY[r.status]) {
        toast({ tone: r.status === "RESOLVED" ? "success" : "info", title: DONE_COPY[r.status], body: r.summary });
      }
    }
  }, [q.data, toast]);
  return q.data?.filter((r) => r.status === "IN_PROGRESS" || r.status === "OPEN").length ?? 0;
}

function Inner({ children }: { children: React.ReactNode }) {
  const { merchant, logout } = useMerchant();
  const pathname = usePathname();
  const busy = useHelpToasts();
  const overview = useMerchantQuery(["overview"], (api) => api.overview());
  const open = overview.data?.open_help_requests ?? 0;

  return (
    <SaathiProvider busyCount={busy}>
      <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
        <aside className="shrink-0 border-line bg-white lg:w-60 lg:border-r">
          <div className="flex items-center justify-between px-5 py-4">
            <Link href="/app" className="block">
              <p className="text-lg font-bold text-navy">Business <span className="text-brand-ink">dashboard</span></p>
              <p className="max-w-44 truncate text-xs text-muted">{merchant?.name}</p>
            </Link>
            <button onClick={logout} aria-label="Sign out" className="rounded p-2 text-muted hover:bg-surface lg:hidden">
              <LogOut className="size-4" />
            </button>
          </div>
          <nav aria-label="Dashboard" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                    active ? "bg-navy-2 text-white" : "text-muted hover:bg-surface hover:text-ink",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                  {href === "/app/help" && open > 0 && <Badge tone="info" className="ml-auto">{open}</Badge>}
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 hidden border-t border-line px-5 py-4 lg:block">
            <p className="truncate text-sm font-medium">{merchant?.name}</p>
            <p className="text-xs text-muted">{overview.data?.merchant.city}{overview.data?.merchant.category ? ` · ${overview.data.merchant.category}` : ""}</p>
            <button onClick={logout} className="mt-3 flex items-center gap-2 text-xs text-muted hover:text-ink">
              <LogOut className="size-3.5" aria-hidden /> Sign out
            </button>
          </div>
        </aside>
        <main className="min-w-0 flex-1 p-4 pb-24 sm:p-6 lg:p-8">{children}</main>
      </div>
    </SaathiProvider>
  );
}

export function MerchantShell({ children }: { children: React.ReactNode }) {
  const { session, ready } = useMerchant();
  const router = useRouter();
  useEffect(() => {
    if (ready && !session) router.replace("/login");
  }, [ready, session, router]);
  if (!ready || !session) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }
  return (
    <ToastProvider>
      <EnvBanner />
      <Inner>{children}</Inner>
    </ToastProvider>
  );
}
