"use client";

import clsx from "clsx";
import { Bell, CheckCircle2, Code2, LayoutDashboard, LifeBuoy, Router, Wallet } from "lucide-react";
import Link from "next/link";
import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { useDemoSession } from "@/lib/demoSession";
import type { Lang } from "@/lib/types";

const COLORS = [
  { name: "Cyan", value: "#00b9f5" },
  { name: "Indigo", value: "#4f46e5" },
  { name: "Green", value: "#12a36b" },
];

interface WidgetEl extends HTMLElement {
  open(): void;
}

const SNIPPET = `<!-- 1. Your backend mints a short-lived token for the signed-in merchant -->
POST /v1/embed/token        (header: X-Saathi-Host-Key)
{ "merchant_id": 1, "language": "hi" }   ->   { "token": "...", "expires_in_s": 1800 }

<!-- 2. Your page drops the widget in -->
<script src="https://saathi.example/saathi-widget.js" defer></script>
<saathi-widget token="{token}" lang="hi" primary="#00b9f5"></saathi-widget>

<!-- 3. Optional: react to what happens inside -->
widget.addEventListener("saathi-case-update", (e) => refreshDevices(e.detail));
widget.addEventListener("saathi-token-expired", () => remintToken());`;

export default function EmbedDemoPage() {
  const { session, error } = useDemoSession();
  const [lang, setLang] = useState<Lang>("hi");
  const [primary, setPrimary] = useState(COLORS[0].value);
  const [loaded, setLoaded] = useState(false);
  const [event, setEvent] = useState<string | null>(null);
  const holder = useRef<HTMLDivElement>(null);
  const merchant = session?.merchants.find((m) => m.name === "Ramesh General Store");

  // Create/update the web component exactly as a host page would.
  useEffect(() => {
    const el = holder.current;
    if (!el || !loaded || !merchant) return;
    let w = el.querySelector("saathi-widget") as WidgetEl | null;
    if (!w) {
      w = document.createElement("saathi-widget") as WidgetEl;
      w.addEventListener("saathi-case-update", (e) => {
        const d = (e as CustomEvent).detail as { state: string; case_ids: number[] };
        setEvent(`Host received saathi-case-update: state=${d.state}, cases=${d.case_ids.join(", ")}`);
      });
      w.addEventListener("saathi-token-expired", () => setEvent("Host received saathi-token-expired: it would re-mint a token now"));
      el.appendChild(w);
    }
    w.setAttribute("token", merchant.token);
    w.setAttribute("lang", lang);
    w.setAttribute("primary", primary);
  }, [loaded, merchant, lang, primary]);

  return (
    <div data-theme="light" className="min-h-screen bg-[#f3f4f6] text-ink">
      <Script src="/saathi-widget.js" strategy="afterInteractive" onReady={() => setLoaded(true)} />
      <div className="bg-amber-100 px-4 py-2 text-center text-xs font-medium text-amber-900">
        An illustrative <strong>example host dashboard</strong> with sample data, not a Paytm screen. It shows how Saathi drops into any merchant dashboard.
        <Link href="/" className="ml-2 underline">Back home</Link>
      </div>
      <div className="mx-auto flex max-w-6xl gap-6 p-4 sm:p-6">
        <aside className="hidden w-52 shrink-0 space-y-1 md:block">
          {[["Home", LayoutDashboard], ["Payments", Wallet], ["Devices", Router], ["Help", LifeBuoy]].map(([label, Icon], i) => {
            const I = Icon as typeof Wallet;
            return <div key={label as string} className={clsx("flex items-center gap-2 rounded-lg px-3 py-2 text-sm", i === 2 ? "bg-card font-semibold shadow-sm" : "text-muted")}><I className="size-4" aria-hidden />{label as string}</div>;
          })}
        </aside>
        <main className="min-w-0 flex-1 space-y-4">
          <header className="flex items-center justify-between">
            <h1 className="text-xl font-bold">Devices</h1>
            <Bell className="size-5 text-muted" aria-label="Notifications" />
          </header>
          <div className="grid gap-3 sm:grid-cols-3">
            {[["Today's collections", "₹12,480"], ["Next settlement", "₹48,250"], ["Active devices", "2"]].map(([k, v]) => (
              <div key={k} className="rounded-xl bg-card p-4 shadow-sm"><p className="text-xs text-muted">{k}</p><p className="mt-1 text-xl font-bold tabular-nums">{v}</p><p className="text-[11px] text-muted">sample data</p></div>
            ))}
          </div>
          <section className="rounded-xl bg-card shadow-sm">
            <h2 className="border-b border-line px-4 py-3 text-sm font-semibold">Your devices</h2>
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div><p className="text-sm font-semibold">Soundbox SB-77120</p><p className="text-xs text-danger">Offline for 49 hours</p></div>
              <button disabled={!loaded || !merchant} onClick={() => (holder.current?.querySelector("saathi-widget") as WidgetEl | null)?.open()} className="rounded-lg bg-navy-2 px-3 py-2 text-sm font-semibold text-white hover:bg-navy disabled:opacity-50">Get help with this device</button>
            </div>
          </section>

          {event && <p role="status" className="flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm"><CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />{event}</p>}

          <section className="rounded-xl bg-card p-4 shadow-sm">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Code2 className="size-4" aria-hidden />The host controls the look and the language</h2>
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div role="group" aria-label="Widget language" className="flex gap-1">
                {(["hi", "hinglish", "en"] as Lang[]).map((l) => <button key={l} aria-pressed={lang === l} onClick={() => setLang(l)} className={clsx("rounded-full px-3 py-1", lang === l ? "bg-navy-2 text-white" : "bg-surface ring-1 ring-line")}>{l}</button>)}
              </div>
              <div role="group" aria-label="Widget accent colour" className="flex gap-1">
                {COLORS.map((c) => <button key={c.value} aria-pressed={primary === c.value} aria-label={c.name} onClick={() => setPrimary(c.value)} className={clsx("size-7 rounded-full ring-2", primary === c.value ? "ring-navy-2" : "ring-transparent")} style={{ background: c.value }} />)}
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-lg bg-navy p-4 font-mono text-xs leading-relaxed text-white/90">{SNIPPET}</pre>
            {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
          </section>
        </main>
      </div>
      <div ref={holder} />
    </div>
  );
}
