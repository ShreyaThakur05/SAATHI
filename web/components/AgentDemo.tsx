"use client";

import clsx from "clsx";
import { BadgeCheck, Check, Loader2, Mic, Pause, Play, RotateCcw, SendHorizontal, Wifi } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ACK, ALT_TEXT, frameAt, REPLY, STEPS, TOTAL_MS, TRANSCRIPT } from "@/lib/agentDemo";
import { Logo } from "./Logo";

const BARS = [0.4, 0.7, 0.5, 0.9, 0.6, 0.35, 0.8, 0.55, 0.95, 0.45, 0.7, 0.3, 0.85, 0.6, 0.5, 0.75, 0.4, 0.9, 0.55, 0.65];
const CHIPS = ["Listen", "Understand", "Look up", "Decide", "Act", "Prove"];

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** The merchant's phone: the chat as they see it. */
function Phone({ f }: { f: ReturnType<typeof frameAt> }) {
  return (
    <div className="mx-auto flex h-full w-full max-w-[15rem] flex-col rounded-[2.2rem] border-[6px] border-[#070f24] bg-[#070f24] shadow-2xl shadow-black/40">
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[1.75rem] bg-white">
        <div aria-hidden className="absolute left-1/2 top-1.5 z-10 h-4 w-20 -translate-x-1/2 rounded-full bg-[#070f24]" />
        <div className="flex items-center justify-between bg-navy px-4 pb-1 pt-2 text-[10px] font-medium text-white/80">
          <span>10:42</span>
          <Wifi className="size-3" aria-hidden />
        </div>
        <div className="flex items-center gap-2.5 bg-navy px-3 pb-3 pt-1.5 text-white">
          <Logo size={32} className="rounded-full bg-white p-0.5" />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Paytm Saathi</p>
            <p className="flex items-center gap-1 text-[10px] text-white/80"><span className="size-1.5 rounded-full bg-[#3ddc97]" />online</p>
          </div>
        </div>
        <div className="flex min-h-[15rem] flex-1 flex-col justify-end gap-2 overflow-hidden bg-[#eef3f9] p-2.5">
          {f.voice && (
            <div className="animate-in ml-auto max-w-[92%] rounded-2xl rounded-br-sm bg-[#d8f1fc] px-3 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={clsx("flex size-6 shrink-0 items-center justify-center rounded-full text-white", f.recording ? "bg-danger" : "bg-navy-2")}><Mic className="size-3" /></span>
                <span className="flex h-5 items-center gap-[2px]">
                  {BARS.map((h, i) => (
                    <span key={i} className="w-[3px] origin-center rounded-full bg-navy-2/70" style={{ height: `${h * 100}%`, animation: f.recording ? `saathi-wave ${0.5 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite` : undefined, transform: f.recording ? undefined : "scaleY(0.6)" }} />
                  ))}
                </span>
                <span className="text-[10px] text-[#3f4d63]">0:06</span>
              </div>
              <p className="mt-1 min-h-4 text-[13px] leading-snug text-ink">{TRANSCRIPT.slice(0, f.transcriptChars)}</p>
            </div>
          )}
          {f.typing && (
            <div className="animate-in flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 shadow-sm">
              {[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-muted" style={{ animation: `saathi-dot 1s ${i * 0.15}s infinite` }} />)}
            </div>
          )}
          {f.ack && <div className="animate-in max-w-[92%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[13px] leading-snug text-ink shadow-sm">{ACK}</div>}
          {f.result && (
            <div className="animate-in max-w-[94%] rounded-2xl rounded-bl-sm bg-white px-3 py-2 text-[13px] leading-snug text-ink shadow-sm">
              {REPLY}
              <div className="mt-1.5 rounded-xl border border-success/30 bg-success/5 p-2 text-[11px]">
                <p className="flex items-center gap-1 font-bold uppercase tracking-wide text-success"><BadgeCheck className="size-3" />{f.verified ? "Done and verified" : "Checking…"}</p>
                <div className="mt-1 flex items-center justify-between"><span>Replacement</span><span className="font-mono font-semibold">RPL-4471</span></div>
                <div className="mt-0.5 flex items-center justify-between"><span>Rent refund</span><span className="font-mono font-semibold">RV-20931</span></div>
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-line bg-white px-2.5 py-2">
          <span className={clsx("flex size-7 items-center justify-center rounded-full", f.recording ? "bg-danger text-white" : "bg-brand text-brand-ink")}><Mic className="size-3.5" /></span>
          <span className="h-7 flex-1 rounded-full bg-surface" />
          <span className="flex size-7 items-center justify-center rounded-full bg-navy-2 text-white"><SendHorizontal className="size-3.5" /></span>
        </div>
      </div>
    </div>
  );
}

/** The support console's case view, the same status pill, six-step bar and proof panel as the real console. */
function ConsoleWindow({ f }: { f: ReturnType<typeof frameAt> }) {
  const s = f.steps;
  const lit = [s[0] !== "pending", s[0] === "done", s[1] !== "pending", s[2] !== "pending", s[3] !== "pending", s[4] !== "pending"];
  const status = f.verified ? "Resolved" : s[0] !== "pending" ? "Working" : "Queued";
  const done = (i: number) => s[i] === "done";
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 bg-[#e8edf6] px-4 py-2">
        <span className="size-2.5 rounded-full bg-[#ff6b6b]" /><span className="size-2.5 rounded-full bg-[#ffc14d]" /><span className="size-2.5 rounded-full bg-[#4cd18a]" />
        <span className="ml-3 text-xs font-medium text-[#3f4d63]">Saathi console · Case #1</span>
      </div>
      <div className="flex flex-1 flex-col justify-between gap-3 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-navy">Soundbox not working</p>
            <p className="text-xs text-muted">Ramesh General Store</p>
          </div>
          <span className={clsx("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", status === "Resolved" ? "bg-success/10 text-success" : status === "Working" ? "bg-brand/15 text-brand-ink" : "bg-surface text-muted ring-1 ring-line")}>
            <span className="size-1.5 rounded-full bg-current" style={status === "Working" ? { animation: "saathi-pulse 1.2s ease-in-out infinite" } : undefined} />{status}
          </span>
        </div>
        <ol className="flex flex-wrap gap-1.5">
          {CHIPS.map((c, i) => (
            <li key={c} className={clsx("rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors duration-300", !lit[i] ? "bg-surface text-muted ring-1 ring-line" : i === 5 && done(4) ? "bg-success text-white" : "bg-navy-2 text-white")}>{c}</li>
          ))}
        </ol>
        <ol className="space-y-1.5 border-t border-line pt-3">
          {STEPS.map((st, i) => (
            <li key={st.kind} className="flex items-start gap-2.5">
              <span className={clsx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-white", s[i] === "done" ? (st.kind === "Prove" ? "bg-success" : "bg-navy-2") : s[i] === "running" ? "bg-brand" : "bg-line")}>
                {s[i] === "done" ? <Check className="size-3" /> : s[i] === "running" ? <Loader2 className="size-3 animate-spin text-brand-ink" /> : <span className="size-1 rounded-full bg-muted" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted">{st.kind}<span className="font-normal tabular-nums">{st.at}</span></span>
                <span className={clsx("block text-[13px] leading-snug transition-colors duration-300", s[i] === "pending" ? "text-muted" : "text-ink")}>{st.short}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="rounded-xl bg-surface p-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Actions and proof</p>
          <ul className="mt-1.5 space-y-1 text-[12px]">
            <li className="flex items-center justify-between"><span className={done(3) ? "text-ink" : "text-muted"}>Replace device · RPL-4471</span><span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", done(3) ? "bg-white text-success ring-1 ring-success/40" : "bg-white text-muted ring-1 ring-line")}>{done(3) ? "proved" : "pending"}</span></li>
            <li className="flex items-center justify-between"><span className={done(4) ? "text-ink" : "text-muted"}>Reverse rent · RV-20931</span><span className={clsx("rounded-full px-2 py-0.5 text-[10px] font-semibold", done(4) ? "bg-white text-success ring-1 ring-success/40" : "bg-white text-muted ring-1 ring-line")}>{done(4) ? "proved" : "pending"}</span></li>
          </ul>
        </div>
      </div>
    </div>
  );
}

/**
 * A short looping product walkthrough: the merchant's phone on one side, the support console's
 * case view on the other, so it shows the real interfaces rather than describing them.
 */
export function AgentDemo({ className }: { className?: string }) {
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [touched, setTouched] = useState(false);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || (reduced && !touched)) return;
    last.current = performance.now();
    const id = setInterval(() => {
      const now = performance.now();
      const dt = now - (last.current ?? now);
      last.current = now;
      setT((prev) => (prev + dt >= TOTAL_MS ? 0 : prev + dt)); // loop
    }, 60);
    return () => clearInterval(id);
  }, [playing, reduced, touched]);

  // people who prefer reduced motion get the finished state until they choose to play it
  const shown = reduced && !touched ? TOTAL_MS : t;
  const f = frameAt(shown);
  const isPlaying = playing && !(reduced && !touched);

  return (
    <div className={clsx("relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-[#0a1f3c] via-[#14246b] to-[#3b2d8f] p-4 shadow-2xl shadow-navy/30 sm:p-5", className)}>
      <p className="sr-only">{ALT_TEXT}</p>
      {/* the stage: a dark backdrop so the two product surfaces read clearly against the page */}
      <div aria-hidden className="pointer-events-none absolute -left-16 -top-16 size-72 rounded-full bg-brand/25 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-20 -right-10 size-72 rounded-full bg-lav/30 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "22px 22px" }} />

      <div className="relative">
        <div className="mb-3 flex items-center gap-2.5">
          <Logo size={30} className="rounded-full bg-white p-0.5" />
          <p className="text-sm font-semibold text-white">Saathi in action</p>
          <span className="ml-auto rounded-full bg-white/15 px-2.5 py-0.5 text-[11px] font-medium text-white ring-1 ring-white/25">Sample data · simulated systems</span>
        </div>

        <div aria-hidden className="grid items-stretch gap-4 md:grid-cols-[15rem_1fr] md:gap-5">
          <div className="flex flex-col">
            <p className="mb-2 text-center text-[11px] font-semibold uppercase tracking-wider text-white/80">What the merchant sees</p>
            <div className="min-h-0 flex-1"><Phone f={f} /></div>
          </div>
          <div className="flex flex-col">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-white/80">What the support team sees</p>
            <div className="min-h-0 flex-1"><ConsoleWindow f={f} /></div>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-full bg-white/10 px-3 py-1.5 ring-1 ring-white/15">
          <button type="button" onClick={() => { setTouched(true); setPlaying(!isPlaying); }} aria-label={isPlaying ? "Pause walkthrough" : "Play walkthrough"} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-navy-2 hover:bg-surface">
            {isPlaying ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
          </button>
          <button type="button" onClick={() => { setTouched(true); setT(0); setPlaying(true); }} aria-label="Replay walkthrough" className="flex size-8 shrink-0 items-center justify-center rounded-full text-white ring-1 ring-white/40 hover:bg-white/10">
            <RotateCcw className="size-4" aria-hidden />
          </button>
          <input type="range" min={0} max={TOTAL_MS} step={100} value={Math.round(shown)} onChange={(e) => { setTouched(true); setPlaying(false); setT(Number(e.target.value)); }} aria-label="Walkthrough progress" className="h-1.5 min-w-0 flex-1 cursor-pointer accent-white" />
        </div>
      </div>
    </div>
  );
}
