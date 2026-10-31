"use client";

import clsx from "clsx";
import { BookOpen, ClipboardList, Gauge, Inbox, ScrollText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { TopBar } from "@/components/TopBar";
import { Badge, Skeleton } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";

const NAV = [
  { href: "/console", label: "Cases", icon: ClipboardList },
  { href: "/console/approvals", label: "Approvals", icon: Inbox },
  { href: "/console/insights", label: "Insights", icon: Gauge },
  { href: "/console/audit", label: "Audit log", icon: ScrollText },
  { href: "/console/skill-packs", label: "Skill Packs", icon: BookOpen },
  { href: "/console/settings", label: "Settings", icon: Settings },
];

export function ConsoleShell({ children }: { children: React.ReactNode }) {
  const { session, user, ready, api, logout } = useStaff();
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === "/console/login";

  useEffect(() => {
    if (ready && !session && !isLogin) router.replace("/console/login");
  }, [ready, session, isLogin, router]);

  const pending = useStaffQuery(["approvals-count"], () => api.approvals("PENDING"), {
    refetchInterval: 4000,
    enabled: !isLogin,
  });

  if (isLogin) return <>{children}</>;
  if (!ready || !session) {
    return (
      <div className="p-8">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <>
    <div className="flex min-h-screen flex-col bg-surface lg:flex-row">
      <aside className="shrink-0 bg-navy text-white lg:w-60">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <Link href="/" className="block">
            <p className="text-lg font-bold">
              Saathi <span className="text-brand">console</span>
            </p>
            <p className="hidden text-xs text-white/60 lg:block">Team workspace</p>
          </Link>
        </div>
        <nav aria-label="Console" className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/console" ? pathname === "/console" || pathname.startsWith("/console/cases") : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex items-center gap-2.5 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-white/15 text-white" : "text-white/70 hover:bg-white/10",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {label}
                {href === "/console/approvals" && !!pending.data?.total && (
                  <Badge tone="warn" className="ml-auto">
                    {pending.data.total}
                  </Badge>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar title={user?.name ?? ""} subtitle={user?.role.replace("_", " ").toLowerCase()} onSignOut={logout} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
    </>
  );
}
