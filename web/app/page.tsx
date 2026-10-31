import {
  ArrowRight,
  BadgeCheck,
  Blocks,
  Check,
  ChevronDown,
  Code2,
  Cog,
  Headset,
  Languages,
  LayoutDashboard,
  Network,
  Radio,
  ScrollText,
  ShieldCheck,
  Store,
  UserCheck,
} from "lucide-react";
import Link from "next/link";
import { AgentDemo } from "@/components/AgentDemo";
import { AgentInline, AgentLauncher, LandingAgentProvider } from "@/components/LandingAgent";
import { Logo } from "@/components/Logo";
import { SceneExplainer } from "@/components/SceneExplainer";

const SNIPPET = `// 1. Your backend: mint a short-lived token for the signed-in merchant
POST /v1/embed/token        // header: X-Saathi-Host-Key
{ "merchant_id": 4271, "language": "hi" }

// 2. Your page: one script tag and one element
<script src="https://saathi.your-domain.com/saathi-widget.js" defer></script>
<saathi-widget token="{token}" lang="hi" primary="#00b9f5"></saathi-widget>

// 3. Optional: react to what happens inside
widget.addEventListener("saathi-case-update", (e) => refreshDevices(e.detail));`;

const SYSTEMS = ["Device status and remote fixes", "Rental billing", "Logistics and replacements", "Settlement ledger and KYC", "Biller network", "Payment gateway (refunds)"];

const FAQ = [
  { q: "What do we have to change in our existing product?", a: "Very little on the front end: a script tag and one element drop the chat into any page, and your backend makes one server-to-server call to mint a short-lived token for the signed-in merchant. Your merchant app, login and design stay as they are. The real integration work is connecting Saathi to your internal systems, and that is isolated behind connector interfaces." },
  { q: "How does it connect to our back-office systems?", a: "Through six connector interfaces: device, billing, logistics, settlement and KYC, biller, and payment gateway. In this sandbox they are simulated with the same shape as the real ones. Going live means implementing those interfaces against your services; the rules, the audit trail and the UI do not change." },
  { q: "Who decides what Saathi is allowed to do?", a: "You do, per product, in a Skill Pack file: the actions allowed, the rupee limits, how success is checked, and when to call a person. A rules engine enforces it. The language model never decides." },
  { q: "Does Saathi move real money in this demo?", a: "No. Every Paytm system here, including the payment gateway, is simulated and all data is fictional." },
  { q: "Which languages and channels?", a: "Hindi, Hinglish and English, by voice or text, in the embedded chat. WhatsApp is not built yet. The channel layer is separate from the core, so it can be added without touching the rules." },
  { q: "Is this an official Paytm product?", a: "No. It is a prototype by Team SoloDance for the Paytm Build for India AI Hackathon, and is not affiliated with or endorsed by Paytm." },
];

function Step({ n, title, body }: { n: number; title: string; body: string }) {
  return (
    <li className="flex gap-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-2 text-sm font-bold text-white">{n}</span>
      <div>
        <h3 className="font-semibold text-ink">{title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-muted">{body}</p>
      </div>
    </li>
  );
}

export default function Home() {
  return (
    <LandingAgentProvider>
    <div className="bg-white text-ink">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2.5">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size={40} />
            <span className="text-xl font-bold tracking-tight text-navy">Saathi</span>
          </Link>
          <nav aria-label="Sections" className="hidden items-center gap-7 text-sm font-medium text-muted lg:flex">
            <a href="#signin" className="hover:text-ink">Sign in</a>
            <a href="#talk" className="hover:text-ink">Talk to Saathi</a>
            <a href="#integrate" className="hover:text-ink">Integration</a>
            <a href="#live" className="hover:text-ink">Live view</a>
            <a href="#safety" className="hover:text-ink">Safety</a>
            <a href="#faq" className="hover:text-ink">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/console" className="hidden rounded-full border border-navy-2/30 px-4 py-2 text-sm font-semibold text-navy-2 hover:bg-surface sm:block">Team console sign in</Link>
            <Link href="/login" className="rounded-full bg-navy-2 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-navy">Merchant sign in</Link>
          </div>
        </div>
      </header>

      <main>
        {/* ---------------------------------------------------------------- hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-[#eef6ff] via-[#f4f2ff] to-white">
          <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 size-[34rem] rounded-full bg-lav/15 blur-3xl" />
          <div className="relative mx-auto grid max-w-6xl items-center gap-8 px-5 pb-12 pt-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10 lg:pb-14 lg:pt-10">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-navy-2 shadow-sm ring-1 ring-line">
                <Blocks className="size-3.5 text-[#5b3fc4]" aria-hidden /> Built to plug into the products you already run
              </p>
              <h1 className="mt-5 text-4xl font-extrabold leading-[1.1] tracking-tight text-navy sm:text-4xl lg:text-[2.45rem]">
                Add an AI teammate to the products you already run.
              </h1>
              <p className="mt-2 bg-gradient-to-r from-navy-2 via-[#4f5fe0] to-[#7050e0] bg-clip-text text-xl font-bold text-transparent">Problems solved, not just answered.</p>
              <p className="mt-4 max-w-xl text-base leading-relaxed text-muted">
                Saathi sits inside your merchant app and support console and connects to your back-office systems. It checks them, makes the fix within your rules, proves it worked, and hands the judgement calls to your team.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href="/login" className="inline-flex items-center gap-2 rounded-full bg-navy-2 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-navy-2/25 hover:bg-navy">
                  <Store className="size-4" aria-hidden /> Merchant sign in <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link href="/console" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-navy-2 shadow-sm ring-1 ring-navy-2/30 hover:bg-surface">
                  <Headset className="size-4" aria-hidden /> Team console sign in
                </Link>
                <Link href="/embed-demo" className="px-2 py-3 text-sm font-semibold text-navy-2 hover:underline">See it inside a dashboard &rarr;</Link>
              </div>
              <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
                <li className="flex items-center gap-2"><Code2 className="size-4 text-navy-2" aria-hidden /> Drop-in widget and API</li>
                <li className="flex items-center gap-2"><Languages className="size-4 text-navy-2" aria-hidden /> Hindi, Hinglish, English</li>
                <li className="flex items-center gap-2"><ShieldCheck className="size-4 text-navy-2" aria-hidden /> Limits and audit in code</li>
              </ul>
            </div>
            <AgentDemo className="mx-auto w-full max-w-[40rem]" />
          </div>
        </section>

        {/* ------------------------------------------------------------- sign in */}
        <section id="signin" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-navy sm:text-4xl">Sign in to your workspace</h2>
            <p className="mx-auto mt-3 max-w-2xl text-lg text-muted">Two ways in, depending on who you are.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Link href="/login" className="group relative flex flex-col overflow-hidden rounded-3xl border-2 border-navy-2 bg-white p-8 shadow-lg shadow-navy-2/10 transition hover:-translate-y-1 hover:shadow-xl">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-navy-2 text-white"><Store className="size-7" aria-hidden /></span>
              <h3 className="mt-5 text-2xl font-bold text-navy">Merchant sign in</h3>
              <p className="mt-2 text-muted">Your business dashboard: devices, settlements, bills and transactions, with Saathi built in to fix problems for you.</p>
              <ul className="mt-5 space-y-2 text-sm text-ink">
                {["See your devices and how they are connected", "Ask Saathi in Hindi, Hinglish or English", "Track every request and what was done"].map((p) => <li key={p} className="flex items-center gap-2"><Check className="size-4 text-success" aria-hidden />{p}</li>)}
              </ul>
              <span className="mt-7 inline-flex items-center gap-2 self-start rounded-full bg-navy-2 px-6 py-3 text-sm font-semibold text-white group-hover:bg-navy">Merchant sign in <ArrowRight className="size-4" aria-hidden /></span>
            </Link>
            <Link href="/console" className="group relative flex flex-col overflow-hidden rounded-3xl border-2 border-line bg-white p-8 shadow-lg shadow-navy/5 transition hover:-translate-y-1 hover:border-navy-2/40 hover:shadow-xl">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-[#5b3fc4] text-white"><Headset className="size-7" aria-hidden /></span>
              <h3 className="mt-5 text-2xl font-bold text-navy">Team console sign in</h3>
              <p className="mt-2 text-muted">For support and risk teams: every case Saathi works, one-click approvals with the evidence attached, and the audit log.</p>
              <ul className="mt-5 space-y-2 text-sm text-ink">
                {["Approve or decline the calls that need judgement", "Open any merchant: profile, map, live device view", "Read the audit log of every rule, action and approver"].map((p) => <li key={p} className="flex items-center gap-2"><Check className="size-4 text-success" aria-hidden />{p}</li>)}
              </ul>
              <span className="mt-7 inline-flex items-center gap-2 self-start rounded-full bg-[#5b3fc4] px-6 py-3 text-sm font-semibold text-white group-hover:bg-[#4a31a8]">Team console sign in <ArrowRight className="size-4" aria-hidden /></span>
            </Link>
          </div>
          <p className="mt-6 text-center text-sm text-muted">This is a sandbox: each sign-in page lists demo accounts you can use.</p>
        </section>

        {/* -------------------------------------------------------- talk to saathi */}
        <section id="talk" className="scroll-mt-24 border-y border-line bg-surface">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5b3fc4]">Talk to Saathi</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Describe a problem and see what it needs</h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">Type or speak, in Hindi, Hinglish or English. Saathi understands what you mean, and because anything that touches an account must be the right account, it asks you to sign in before it looks at anything.</p>
              <ul className="mt-6 space-y-3">
                {["It answers in the language you write in", "It never guesses who you are, and never asks for a PIN or OTP", "After you sign in, the same Saathi checks your account and fixes it"].map((p) => (
                  <li key={p} className="flex items-start gap-3"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"><Check className="size-3.5" aria-hidden /></span>{p}</li>
                ))}
              </ul>
            </div>
            <AgentInline />
          </div>
        </section>

        {/* ------------------------------------------------- how it fits in (diagram) */}
        <section id="integrate" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#5b3fc4]">Integration</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">Where Saathi fits in your stack</h2>
            <p className="mt-3 text-lg text-muted">No new app for merchants to learn, and no rewrite of your systems. Saathi appears inside the surfaces you already have and works through interfaces to the systems behind them.</p>
          </div>

          <div className="mt-10 grid items-stretch gap-4 lg:grid-cols-[1fr_auto_1.15fr_auto_1fr]">
            <div className="rounded-3xl border border-line bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your existing products</p>
              <ul className="mt-4 space-y-3">
                <li className="flex items-center gap-3 rounded-xl bg-surface p-3"><LayoutDashboard className="size-5 text-navy-2" aria-hidden /><span className="text-sm font-medium">Merchant app or dashboard</span></li>
                <li className="flex items-center gap-3 rounded-xl bg-surface p-3"><Headset className="size-5 text-navy-2" aria-hidden /><span className="text-sm font-medium">Support console</span></li>
              </ul>
              <p className="mt-4 text-xs text-muted">Keep your login, design and navigation. Saathi is a docked chat plus a console.</p>
            </div>
            <div aria-hidden className="hidden items-center text-muted lg:flex"><ArrowRight className="size-6" /></div>

            <div className="rounded-3xl border-2 border-navy-2/20 bg-gradient-to-b from-[#f4f2ff] to-white p-6 shadow-lg shadow-navy/5">
              <div className="flex items-center gap-2.5"><Logo size={32} /><p className="font-bold text-navy">Saathi core</p></div>
              <ol className="mt-4 grid grid-cols-2 gap-2 text-sm">
                {["Listen", "Understand", "Look up", "Decide", "Act", "Prove"].map((s, i) => (
                  <li key={s} className={`rounded-lg px-3 py-2 font-medium ${i === 5 ? "bg-success/10 text-success" : "bg-white text-ink ring-1 ring-line"}`}>{i + 1}. {s}</li>
                ))}
              </ol>
              <p className="mt-4 text-xs text-muted">Rules, limits and approvals come from a Skill Pack per product. Every action has one ID and goes on an append-only audit log.</p>
            </div>
            <div aria-hidden className="hidden items-center text-muted lg:flex"><ArrowRight className="size-6" /></div>

            <div className="rounded-3xl border border-line bg-white p-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your systems, behind connectors</p>
              <ul className="mt-4 space-y-2">
                {SYSTEMS.map((s) => <li key={s} className="flex items-center gap-2.5 text-sm"><Network className="size-4 shrink-0 text-navy-2" aria-hidden />{s}</li>)}
              </ul>
              <p className="mt-4 rounded-lg bg-warn/10 px-3 py-2 text-xs text-ink">In this sandbox these are simulated, with the same shape as the real ones.</p>
            </div>
          </div>

          <div className="mt-12 grid gap-8 lg:grid-cols-2">
            <div>
              <h3 className="text-xl font-semibold text-navy">Three ways in, from smallest to deepest</h3>
              <ol className="mt-6 space-y-6">
                <Step n={1} title="Embed the widget" body="A script tag and a web component. Your backend mints a short-lived token for the signed-in merchant. Theme it with your colour and language." />
                <Step n={2} title="Give your team the console" body="Cases, one-click approvals with the evidence attached, an audit log, and a view of each merchant with their devices and history." />
                <Step n={3} title="Connect your real systems" body="Implement the six connector interfaces against your services. The rules engine, proof step, audit trail and both UIs stay exactly as they are." />
              </ol>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/embed-demo" className="inline-flex items-center gap-2 rounded-full bg-navy-2 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy">See the embedded widget</Link>
                <Link href="/console" className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold text-navy-2 ring-1 ring-line hover:bg-surface">Open the console</Link>
              </div>
            </div>
            <div className="overflow-hidden rounded-3xl bg-navy shadow-xl shadow-navy/20">
              <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
                <span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" /><span className="size-2.5 rounded-full bg-white/20" />
                <span className="ml-3 text-xs text-white/60">Embedding Saathi</span>
              </div>
              <pre tabIndex={0} aria-label="Embedding example code" className="overflow-x-auto p-5 font-mono text-[12.5px] leading-relaxed text-white/90"><code>{SNIPPET}</code></pre>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- what it does */}
        <section id="how" className="scroll-mt-24 border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5b3fc4]">What it does inside your product</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">From a message to a verified fix</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
              {[
                { icon: Languages, title: "Understands merchants", body: "Hindi, Hinglish and English, voice or text. One message can hold two problems; Saathi splits them into separate cases and the whole chat converts when the language changes." },
                { icon: Cog, title: "Acts within your rules", body: "Remote fixes, replacements, rent reversals up to a limit, refunds when the biller confirms failure. Anything else goes to a person." },
                { icon: BadgeCheck, title: "Proves it before closing", body: "It re-checks the system of record. A refund counts only on success; a device fix only when it is back online." },
                { icon: UserCheck, title: "Hands off with evidence", body: "Holds, big amounts, repeat claims and mismatches reach your team pre-built for a one-click decision." },
              ].map((c) => (
                <div key={c.title} className="rounded-3xl border border-line bg-white p-6 shadow-sm">
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-lav/15 text-navy-2"><c.icon className="size-5" aria-hidden /></span>
                  <h3 className="mt-4 font-semibold text-ink">{c.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{c.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------- live view */}
        <section id="live" className="mx-auto grid max-w-6xl scroll-mt-24 items-center gap-12 px-5 py-20 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-[#5b3fc4]">Live connection view</p>
            <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">See how a device connects, in real time</h2>
            <p className="mt-4 text-lg leading-relaxed text-muted">Merchants and support staff can watch the path from device to cell site to your service, with heartbeats, signal and round-trip time, and see exactly which hop is broken and what Saathi is doing about it.</p>
            <ul className="mt-6 space-y-3">
              {["Shows the failing hop, not just “offline”", "Follows Saathi step by step while it fixes the device", "Same view for the merchant and for your team"].map((p) => (
                <li key={p} className="flex items-start gap-3"><span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-success/10 text-success"><Check className="size-3.5" aria-hidden /></span>{p}</li>
              ))}
            </ul>
            <p className="mt-4 flex items-center gap-2 text-sm text-muted"><Radio className="size-4" aria-hidden /> Telemetry is simulated in this sandbox.</p>
          </div>
          <SceneExplainer />
        </section>

        {/* -------------------------------------------------------------- safety */}
        <section id="safety" className="border-y border-line bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-20">
            <div className="max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-wide text-[#5b3fc4]">Safe to put in front of your merchants</p>
              <h2 className="mt-2 text-3xl font-bold tracking-tight text-navy sm:text-4xl">The AI reads the message. Rules decide what happens.</h2>
            </div>
            <div className="mt-10 grid gap-5 md:grid-cols-3">
              {[
                { icon: ShieldCheck, title: "Limits live in code", body: "Rupee limits, repeat-claim rules and approval requirements are enforced by a rules engine from each Skill Pack. Instructions hidden in a message are ignored." },
                { icon: ScrollText, title: "Every step on record", body: "One ID per action, so nothing runs twice. An append-only audit log records every rule, action and approver, and the database refuses edits." },
                { icon: UserCheck, title: "People stay in control", body: "Role-based approvals with a recorded reason. Personal data is masked before storage or any model sees it, and a PIN or OTP is never requested." },
              ].map((s) => (
                <div key={s.title} className="rounded-3xl border border-line bg-white p-7 shadow-sm">
                  <s.icon className="size-6 text-navy-2" aria-hidden />
                  <h3 className="mt-4 text-lg font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ----------------------------------------------------------------- faq */}
        <section id="faq" className="mx-auto max-w-3xl scroll-mt-24 px-5 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight text-navy sm:text-4xl">Questions about integrating</h2>
          <div className="mt-8 divide-y divide-line rounded-3xl border border-line bg-white">
            {FAQ.map((f) => (
              <details key={f.q} className="group px-6 py-4">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
                  {f.q}
                  <ChevronDown className="size-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-3 leading-relaxed text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ------------------------------------------------------------------ cta */}
        <section className="px-5 pb-20">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] bg-gradient-to-r from-navy-2 via-[#3b4fd6] to-[#6a4fe0] p-10 text-white sm:p-14">
            <div className="relative flex flex-wrap items-center justify-between gap-8">
              <div className="max-w-xl">
                <h2 className="text-3xl font-bold sm:text-4xl">Try it in a working product</h2>
                <p className="mt-3 text-lg text-white/80">Open the merchant app with a device offline, or the support console, or see the widget embedded in a separate dashboard.</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link href="/embed-demo" className="rounded-full bg-white px-7 py-3.5 font-semibold text-navy-2 hover:bg-surface">See it embedded</Link>
                <Link href="/login" className="rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white hover:bg-white/10">Merchant sign in</Link>
                <Link href="/console" className="rounded-full border border-white/40 px-7 py-3.5 font-semibold text-white hover:bg-white/10">Team console</Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface px-5 py-12">
        <div className="mx-auto grid max-w-6xl gap-10 text-sm text-muted md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5"><Logo size={40} /><span className="text-xl font-bold text-navy">Saathi</span></div>
            <p className="mt-3 max-w-xs">Problems solved, not just answered. One AI teammate for every Paytm product.</p>
          </div>
          <div><p className="font-semibold text-ink">Integration</p><ul className="mt-3 space-y-2"><li><a href="#integrate" className="hover:text-ink">Where it fits</a></li><li><Link href="/embed-demo" className="hover:text-ink">Embedded widget</Link></li><li><a href="#faq" className="hover:text-ink">FAQ</a></li></ul></div>
          <div><p className="font-semibold text-ink">Try it</p><ul className="mt-3 space-y-2"><li><Link href="/login" className="hover:text-ink">Merchant app</Link></li><li><Link href="/console" className="hover:text-ink">Team console</Link></li></ul></div>
          <div><p className="font-semibold text-ink">Developers</p><ul className="mt-3 space-y-2"><li><a href="https://github.com/ShreyaThakur05/SAATHI" className="hover:text-ink">Source on GitHub</a></li><li><a href="#safety" className="hover:text-ink">Safety model</a></li></ul></div>
        </div>
       </footer>
    </div>
    <AgentLauncher />
    </LandingAgentProvider>
  );
}
