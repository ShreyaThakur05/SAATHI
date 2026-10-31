import { ArrowRight, CheckCheck, ListTree, Mic, Scale, Search, Store, Headset, Zap } from "lucide-react";
import Link from "next/link";

const STEPS = [
  { icon: Mic, name: "Listen", body: "Voice or text in Hindi, Hinglish or English" },
  { icon: ListTree, name: "Understand", body: "Splits one message into separate cases" },
  { icon: Search, name: "Look up", body: "Device, billing, settlement, KYC, payments" },
  { icon: Scale, name: "Decide", body: "A rules engine applies the product's limits" },
  { icon: Zap, name: "Act", body: "Fix, replace, reverse, refund, or ask once" },
  { icon: CheckCheck, name: "Prove", body: "Re-checks the system before closing" },
];

export default function Home() {
  return (
    <div className="bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <p className="text-lg font-bold text-navy">Saathi</p>
        <nav className="flex items-center gap-2 text-sm">
          <Link href="/login" className="rounded-lg px-3 py-2 font-medium text-muted hover:text-ink">Merchant sign in</Link>
          <Link href="/console" className="rounded-lg bg-navy-2 px-4 py-2 font-semibold text-white hover:bg-navy">Team console</Link>
        </nav>
      </header>

      <section className="bg-navy text-white">
        <div className="mx-auto max-w-5xl px-5 py-16 sm:py-24">
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">Problems solved, not just answered.</h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            One AI teammate for every Paytm product. When a merchant has a problem, Saathi checks the systems, takes the fix within the rules, confirms it really worked, and calls a person only when a human decision is needed.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <Link href="/login" className="group rounded-2xl bg-white p-6 text-ink hover:shadow-xl">
              <Store className="size-6 text-navy-2" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold">I&rsquo;m a merchant</h2>
              <p className="mt-1 text-sm text-muted">See your devices, settlements and bills, and get help in your own language.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-navy-2">Sign in <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
            </Link>
            <Link href="/console" className="group rounded-2xl bg-white/10 p-6 ring-1 ring-white/20 hover:bg-white/15">
              <Headset className="size-6 text-brand" aria-hidden />
              <h2 className="mt-3 text-lg font-semibold">I&rsquo;m on the support team</h2>
              <p className="mt-1 text-sm text-white/70">Watch every case, approve the calls that need judgement, audit every action.</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand">Open the console <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden /></span>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-14">
        <h2 className="text-2xl font-bold text-navy">Six steps. The last one is the one that matters.</h2>
        <ol className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.name} className="rounded-xl border border-line p-4">
              <span className={`flex size-9 items-center justify-center rounded-full text-white ${i === 5 ? "bg-success" : "bg-navy-2"}`}><s.icon className="size-4" aria-hidden /></span>
              <h3 className="mt-3 font-semibold">{i + 1}. {s.name}</h3>
              <p className="text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-sm text-muted">A refund counts only when the payment system says SUCCESS. A device fix counts only when the device is actually back online.</p>
      </section>

      <footer className="border-t border-line px-5 py-8 text-center text-xs text-muted">
        <p>Team SoloDance · Paytm Build for India AI Hackathon · Sandbox with simulated systems and fictional data · Not affiliated with or endorsed by Paytm</p>
        <p className="mt-2"><Link href="/embed-demo" className="underline hover:text-ink">How Saathi embeds into an existing dashboard</Link></p>
      </footer>
    </div>
  );
}
