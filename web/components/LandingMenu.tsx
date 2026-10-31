"use client";

import { Headset, Menu, Store } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ThemeToggle } from "./ThemeToggle";
import { Sheet } from "./ui/Sheet";

const LINKS = [
  ["#signin", "Sign in"],
  ["#talk", "Talk to Saathi"],
  ["#story", "Break something"],
  ["#integrate", "Integration"],
  ["#live", "Live view"],
  ["#safety", "Safety"],
  ["#faq", "FAQ"],
];

/** The landing page's navigation on phones: a menu button that opens a sheet. */
export function LandingMenu() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-haspopup="dialog" className="flex size-11 items-center justify-center rounded-full text-ink ring-1 ring-line hover:bg-surface lg:hidden">
        <Menu className="size-5" aria-hidden />
      </button>
      <Sheet open={open} title="Menu" onClose={() => setOpen(false)}>
        <div className="grid gap-2 pb-3">
          <Link href="/login" className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-navy-2 text-base font-semibold text-white">
            <Store className="size-5" aria-hidden /> Merchant sign in
          </Link>
          <Link href="/console" className="flex min-h-12 items-center justify-center gap-2 rounded-full text-base font-semibold text-link ring-1 ring-link/40">
            <Headset className="size-5" aria-hidden /> Team console sign in
          </Link>
        </div>
        <ul className="border-t border-line pt-2">
          {LINKS.map(([href, label]) => (
            <li key={href}>
              <a href={href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-xl px-3 text-base font-medium hover:bg-surface">{label}</a>
            </li>
          ))}
        </ul>
        <div className="mt-2 border-t border-line pt-3">
          <ThemeToggle label className="w-full justify-start rounded-xl ring-0 hover:bg-surface" />
        </div>
      </Sheet>
    </>
  );
}
