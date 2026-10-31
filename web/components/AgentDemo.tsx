"use client";

import clsx from "clsx";
import { BadgeCheck, Check, Loader2, Mic, Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ACK, ALT_TEXT, frameAt, REPLY, STEPS, TOTAL_MS, TRANSCRIPT } from "@/lib/agentDemo";
import { Logo } from "./Logo";

const BARS = [0.4, 0.7, 0.5, 0.9, 0.6, 0.35, 0.8, 0.55, 0.95, 0.45, 0.7, 0.3, 0.85, 0.6, 0.5, 0.75, 0.4, 0.9, 0.55, 0.65, 0.35, 0.8, 0.5, 0.7];

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

/** A short looping walkthrough of the agent: voice note in, two cases fixed and proved, references out. */
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
    <div className={clsx("overflow-hidden rounded-3xl border border-line bg-white shadow-2xl shadow-navy/10", className)}>
      <p className="sr-only">{ALT_TEXT}</p>
      <div className="flex items-center gap-3 border-b border-line bg-surface px-4 py-2.5">
        <Logo size={28} className="rounded-full bg-white p-0.5" />
        <p className="text-sm font-semibold text-navy">Saathi in action</p>
        <span className="ml-auto rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-muted ring-1 ring-line">Sample walkthrough</span>
      </div>

      <div aria-hidden className="grid md:grid-cols-[1fr_1.05fr]">
        {/* the merchant's side */}
        <div className="flex min-h-[19rem] flex-col justify-end gap-2.5 bg-[#eef3f9] p-4">
          {f.voice && (
            <div className="animate-in ml-auto max-w-[88%] rounded-2xl rounded-br-sm bg-[#d8f1fc] px-3.5 py-2.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className={clsx("flex size-7 shrink-0 items-center justify-center rounded-full", f.recording ? "bg-danger text-white" : "bg-navy-2 text-white")}><Mic className="size-3.5" /></span>
                <span className="flex h-6 items-center gap-[2px]">
                  {BARS.map((h, i) => (
                    <span key={i} className="w-[3px] origin-center rounded-full bg-navy-2/70" style={{ height: `${h * 100}%`, animation: f.recording ? `saathi-wave ${0.5 + (i % 5) * 0.12}s ease-in-out ${i * 0.03}s infinite` : undefined, transform: f.recording ? undefined : "scaleY(0.6)" }} />
                  ))}
                </span>
                <span className="text-[11px] text-[#3f4d63]">0:06</span>
              </div>
              <p className="mt-1.5 min-h-5 text-sm text-ink">{TRANSCRIPT.slice(0, f.transcriptChars)}</p>
            </div>
          )}
          {f.typing && (
            <div className="animate-in flex w-fit items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm">
              {[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-muted" style={{ animation: `saathi-dot 1s ${i * 0.15}s infinite` }} />)}
            </div>
          )}
          {f.ack && <div className="animate-in max-w-[88%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm">{ACK}</div>}
          {f.result && (
            <div className="animate-in max-w-[92%] rounded-2xl rounded-bl-sm bg-white px-3.5 py-2.5 text-sm text-ink shadow-sm">
              {REPLY}
              <div className="mt-2 rounded-xl border border-success/30 bg-success/5 p-2.5 text-xs">
                <p className="flex items-center gap-1.5 font-bold uppercase tracking-wide text-success"><BadgeCheck className="size-3.5" />{f.verified ? "Done and verified" : "Checking…"}</p>
                <div className="mt-1.5 flex items-center justify-between"><span>Replacement</span><span className="font-mono font-semibold">RPL-4471</span></div>
                <div className="mt-1 flex items-center justify-between"><span>Rent refund</span><span className="font-mono font-semibold">RV-20931 · Success</span></div>
              </div>
            </div>
          )}
        </div>

        {/* what Saathi does */}
        <div className="border-t border-line bg-white p-5 md:border-l md:border-t-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">What Saathi does</p>
          <ol className="mt-3 space-y-3">
            {STEPS.map((s, i) => {
              const st = f.steps[i];
              return (
                <li key={s.kind} className="flex items-start gap-3">
                  <span className={clsx("mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-white", st === "done" ? (s.kind === "Prove" ? "bg-success" : "bg-navy-2") : st === "running" ? "bg-brand" : "bg-line")}>
                    {st === "done" ? <Check className="size-3.5" /> : st === "running" ? <Loader2 className="size-3.5 animate-spin text-brand-ink" /> : <span className="size-1.5 rounded-full bg-muted" />}
                  </span>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted">{s.kind}<span className="tabular-nums font-normal">{s.at}</span></span>
                    <span className={clsx("block text-sm leading-snug transition-colors duration-300", st === "pending" ? "text-muted" : "text-ink")}>{s.text}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line bg-surface px-4 py-2.5">
        <button type="button" onClick={() => { setTouched(true); setPlaying(!isPlaying); }} aria-label={isPlaying ? "Pause walkthrough" : "Play walkthrough"} className="flex size-8 shrink-0 items-center justify-center rounded-full bg-navy-2 text-white hover:bg-navy">
          {isPlaying ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </button>
        <button type="button" onClick={() => { setTouched(true); setT(0); setPlaying(true); }} aria-label="Replay walkthrough" className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted ring-1 ring-line hover:text-ink">
          <RotateCcw className="size-4" aria-hidden />
        </button>
        <input type="range" min={0} max={TOTAL_MS} step={100} value={Math.round(shown)} onChange={(e) => { setTouched(true); setPlaying(false); setT(Number(e.target.value)); }} aria-label="Walkthrough progress" className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#002e6e]" />
        <span className="hidden shrink-0 text-[11px] text-muted sm:block">Sample data, simulated systems</span>
      </div>
    </div>
  );
}
