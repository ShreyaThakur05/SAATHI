import {
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  CreditCard,
  FileText,
  Landmark,
  Languages,
  Mic,
  Receipt,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Speaker,
  Store,
  Headset,
  UserCheck,
  Wallet,
} from "lucide-react";
import Link from "next/link";

const PRODUCTS = [
  { icon: Speaker, name: "Soundbox", body: "Remote restart, replacement orders, and rent reversed for downtime.", live: true },
  { icon: CreditCard, name: "Card machine", body: "Diagnose, re-pair and replace, with the result confirmed.", live: true },
  { icon: Landmark, name: "Settlements and KYC", body: "Finds the one missing document and prepares the case for approval.", live: true },
  { icon: Receipt, name: "Bill payments", body: "Checks the biller, refunds failed payments, confirms the refund.", live: true },
  { icon: Wallet, name: "UPI payments", body: "Status and refund deadline tracking.", live: false },
  { icon: FileText, name: "Merchant loans", body: "Explain deductions and fix wrong ones within limits.", live: false },
];

const SAFETY = [
  { icon: ShieldCheck, title: "Limits live in code", body: "Rupee limits and approval rules are read from each product's Skill Pack by a rules engine. The AI never decides what is allowed." },
  { icon: BadgeCheck, title: "Proof before closing", body: "A refund counts only when the payment system says success. A device fix counts only when the device is back online." },
  { icon: ScrollText, title: "Every step on record", body: "Each action has one ID and cannot run twice. Every rule, action and approver goes into an append-only audit log." },
];

function ProductPreview() {
  return (
    <div className="relative mx-auto mb-32 w-full max-w-xl" aria-hidden>
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-2xl shadow-navy/10">
        <div className="flex items-center gap-1.5 border-b border-line bg-surface px-4 py-2.5">
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="size-2.5 rounded-full bg-line" />
          <span className="ml-3 text-xs text-muted">Business dashboard</span>
        </div>
        <div className="space-y-4 bg-surface p-5">
          <div className="grid grid-cols-3 gap-3">
            {[["Collected today", "₹1,920"], ["Last 7 days", "₹19,900"], ["Devices online", "1 of 1"]].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-line bg-white p-3">
                <p className="text-[11px] text-muted">{k}</p>
                <p className="mt-0.5 text-lg font-bold tabular-nums text-ink">{v}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/5 p-3">
            <CircleAlert className="size-5 shrink-0 text-danger" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-ink">Soundbox SB-77120 is offline</p>
              <p className="text-xs text-muted">No signal for 49 hours.</p>
            </div>
            <span className="flex items-center gap-1.5 rounded-lg bg-navy-2 px-3 py-1.5 text-xs font-semibold text-white">
              <Sparkles className="size-3.5 text-brand" /> Resolve with Saathi
            </span>
          </div>
        </div>
      </div>
      <div className="absolute -bottom-32 right-2 w-[82%] rounded-2xl border border-line bg-white p-4 shadow-xl shadow-navy/15 sm:-right-4">
        <p className="rounded-xl rounded-bl-sm bg-surface px-3 py-2 text-sm text-ink">The remote fix did not work, so we are sending a new device.</p>
        <div className="mt-2 rounded-xl border border-success/30 bg-success/5 p-3 text-sm">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-success">
            <ClipboardCheck className="size-3.5" /> Done and verified
          </p>
          <div className="mt-1.5 flex items-center justify-between">
            <span>Replacement</span>
            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold ring-1 ring-line">RPL-4471</span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Rent refund</span>
            <span className="rounded bg-white px-1.5 py-0.5 font-mono text-xs font-semibold ring-1 ring-line">RV-20931</span>
          </div>
        </div>
        <p className="mt-2 text-right text-[10px] text-muted">Sample data</p>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="bg-white text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold text-navy">
            <span className="flex size-8 items-center justify-center rounded-lg bg-navy-2 text-sm text-white" aria-hidden>S</span>
            Saathi
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
            <a href="#products" className="hover:text-ink">Products</a>
            <a href="#how" className="hover:text-ink">How it works</a>
            <a href="#safety" className="hover:text-ink">Safety</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-ink hover:bg-surface">Merchant sign in</Link>
            <Link href="/console" className="hidden rounded-lg bg-navy-2 px-4 py-2 text-sm font-semibold text-white hover:bg-navy sm:block">Team console</Link>
          </div>
        </div>
      </header>

      <main>
        <section className="bg-gradient-to-b from-surface to-white">
          <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-24 pt-14 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-brand/15 px-3 py-1 text-xs font-semibold text-brand-ink">
                <Sparkles className="size-3.5" aria-hidden /> AI teammate for every Paytm product
              </p>
              <h1 className="mt-5 text-4xl font-bold tracking-tight text-navy sm:text-5xl">
                Problems solved,<br />not just answered.
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
                A merchant says what is wrong, in their own language. Saathi checks the systems, makes the fix within the rules, confirms it really worked, and brings in a person only when a human decision is needed.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/login" className="inline-flex items-center gap-2 rounded-xl bg-navy-2 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-navy">
                  <Store className="size-4" aria-hidden /> Sign in as a merchant <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/console" className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-6 py-3 text-sm font-semibold text-ink hover:bg-surface">
                  <Headset className="size-4" aria-hidden /> Open the team console
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                <li className="flex items-center gap-2"><Languages className="size-4 text-navy-2" aria-hidden /> Hindi, Hinglish and English</li>
                <li className="flex items-center gap-2"><Mic className="size-4 text-navy-2" aria-hidden /> Voice-first</li>
                <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-navy-2" aria-hidden /> Never asks for a PIN or OTP</li>
              </ul>
            </div>
            <ProductPreview />
          </div>
        </section>

        <section id="products" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-navy">One teammate, a Skill Pack for each product</h2>
            <p className="mt-3 text-muted">Each product is a small file that lists its problems, the actions allowed, the rupee limits, how success is checked, and when to call a person. Adding a product does not mean building a new bot.</p>
          </div>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p) => (
              <li key={p.name} className={`rounded-2xl border p-5 ${p.live ? "border-line bg-white" : "border-dashed border-line bg-surface/60"}`}>
                <div className="flex items-start justify-between">
                  <span className={`flex size-10 items-center justify-center rounded-xl ${p.live ? "bg-navy-2/10 text-navy-2" : "bg-line/60 text-muted"}`}>
                    <p.icon className="size-5" aria-hidden />
                  </span>
                  <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${p.live ? "bg-success/10 text-success" : "bg-white text-muted ring-1 ring-line"}`}>{p.live ? "Available" : "Coming next"}</span>
                </div>
                <h3 className="mt-4 font-semibold text-ink">{p.name}</h3>
                <p className="mt-1 text-sm text-muted">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id="how" className="scroll-mt-20 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <h2 className="text-3xl font-bold tracking-tight text-navy">How a problem gets solved</h2>
            <div className="mt-10 grid gap-10 md:grid-cols-3">
              {[
                { icon: Mic, title: "Tell Saathi", body: "Speak or type, in Hindi, Hinglish or English. One message can hold two problems, and Saathi splits them into separate cases." },
                { icon: ClipboardCheck, title: "Saathi fixes it and proves it", body: "It looks up the device, billing, settlement and payment records, applies the product's rules, acts, then re-checks the system before closing." },
                { icon: UserCheck, title: "People make the judgement calls", body: "Releasing a hold, amounts over a limit, repeat claims and mismatches go to your team with the evidence already collected, ready to approve in one click." },
              ].map((s, i) => (
                <div key={s.title}>
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-full bg-navy-2 text-white"><s.icon className="size-5" aria-hidden /></span>
                    <span className="text-sm font-semibold text-muted">Step {i + 1}</span>
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="safety" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight text-navy">Built so you can trust what it does</h2>
            <p className="mt-3 text-muted">Saathi can only take actions its Skill Pack allows, inside its limits. Instructions hidden in a message are ignored, and anything risky goes to a person.</p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {SAFETY.map((s) => (
              <div key={s.title} className="rounded-2xl border border-line p-6">
                <s.icon className="size-6 text-navy-2" aria-hidden />
                <h3 className="mt-4 font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="px-5 pb-20">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-6 rounded-3xl bg-navy p-8 sm:p-12">
            <div>
              <h2 className="text-2xl font-bold text-white sm:text-3xl">See it work on a real account</h2>
              <p className="mt-2 max-w-xl text-white/70">Sign in as a merchant with a device offline, or as the support team approving what Saathi prepared.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link href="/login" className="rounded-xl bg-white px-6 py-3 text-sm font-semibold text-navy hover:bg-surface">Merchant sign in</Link>
              <Link href="/console" className="rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">Team console</Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-white px-5 py-10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-start justify-between gap-6 text-sm text-muted">
          <div className="max-w-md">
            <p className="font-semibold text-ink">Saathi</p>
            <p className="mt-1">Built by Team SoloDance for the Paytm Build for India AI Hackathon. Runs on simulated systems with fictional data, and is not affiliated with or endorsed by Paytm.</p>
          </div>
          <ul className="space-y-2">
            <li><Link href="/login" className="hover:text-ink">Merchant sign in</Link></li>
            <li><Link href="/console" className="hover:text-ink">Team console</Link></li>
            <li><Link href="/embed-demo" className="hover:text-ink">Embedding in an existing dashboard</Link></li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
