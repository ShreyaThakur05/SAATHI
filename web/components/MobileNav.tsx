"use client";

import clsx from "clsx";
import { LogOut, MoreHorizontal, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { Sheet } from "./ui/Sheet";
import { Badge } from "./ui/primitives";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

/** Phone navigation: a bottom tab bar with the main pages, and a "More" sheet for the rest. */
export function MobileNav({ items, isActive, primaryCount = 4, onSignOut }: { items: NavItem[]; isActive: (href: string) => boolean; primaryCount?: number; onSignOut: () => void }) {
  const [more, setMore] = useState(false);
  const primary = items.slice(0, primaryCount);
  const rest = items.slice(primaryCount);
  const moreActive = rest.some((i) => isActive(i.href));
  const cell = "relative flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 text-[11px] font-medium";
  return (
    <>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid" style={{ gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))` }}>
          {primary.map((i) => (
            <li key={i.href}>
              <Link href={i.href} aria-current={isActive(i.href) ? "page" : undefined} className={clsx(cell, isActive(i.href) ? "text-link" : "text-muted")}>
                <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full", isActive(i.href) && "bg-link/15")}>
                  <i.icon className="size-5" aria-hidden />
                </span>
                {i.label}
                {!!i.badge && <Badge tone="warn" className="absolute right-2 top-1.5 !px-1.5 !py-0">{i.badge}</Badge>}
              </Link>
            </li>
          ))}
          <li>
            <button type="button" onClick={() => setMore(true)} aria-haspopup="dialog" className={clsx(cell, "w-full", moreActive ? "text-link" : "text-muted")}>
              <span className={clsx("flex h-7 w-12 items-center justify-center rounded-full", moreActive && "bg-link/15")}>
                <MoreHorizontal className="size-5" aria-hidden />
              </span>
              More
            </button>
          </li>
        </ul>
      </nav>
      <Sheet open={more} title="More" onClose={() => setMore(false)}>
        <ul className="space-y-1">
          {rest.map((i) => (
            <li key={i.href}>
              <Link href={i.href} onClick={() => setMore(false)} aria-current={isActive(i.href) ? "page" : undefined} className={clsx("flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium hover:bg-surface", isActive(i.href) ? "text-link" : "text-ink")}>
                <i.icon className="size-5" aria-hidden /> {i.label}
                {!!i.badge && <Badge tone="warn" className="ml-auto">{i.badge}</Badge>}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-2 border-t border-line pt-3">
          <ThemeToggle label className="w-full justify-start rounded-xl ring-0 hover:bg-surface" />
          <button type="button" onClick={onSignOut} className="flex min-h-12 w-full items-center gap-3 rounded-xl px-4 text-base font-medium text-danger hover:bg-surface">
            <LogOut className="size-5" aria-hidden /> Sign out
          </button>
        </div>
      </Sheet>
    </>
  );
}
