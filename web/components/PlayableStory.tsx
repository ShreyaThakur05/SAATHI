"use client";

import clsx from "clsx";
import { AlertTriangle, BadgeCheck, Check, Loader2, RotateCcw, ShieldCheck, Wrench } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { FIX_MS, nextPhase, type Phase, STORIES, storyFrame, type Story } from "@/lib/stories";

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};

function Dashboard({ story, phase }: { story: Story; phase: Phase }) {
  const broken = phase === "broken";
  const value = (v: { healthy: string; broken: string; fixed: string }) =>
    phase === "healthy" ? v.healthy : phase === "fixed" || phase === "approved" ? v.fixed : v.broken;
  const panelText =
    phase === "approved" && story.approvedPanel ? story.approvedPanel : value(story.panel);
  const good = phase === "healthy" || phase === "approved" || (phase === "fixed" && !story.needsApproval);
  return (
    <div data-theme="light" className="rounded-2xl border border-line bg-card p-4 text-ink shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Merchant dashboard · sample data</p>
      {broken && (
        <div role="alert" className="mt-3 flex gap-2 rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-danger" aria-hidden />
          <div>
            <p className="font-semibold text-danger">{story.alert.title}</p>
            <p className="text-ink">{story.alert.body}</p>
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-line p-3">
          <p className="text-xs text-muted">{story.tile.label}</p>
          <p className={clsx("mt-1 text-lg font-bold", broken ? "text-danger" : "text-heading")}>{value(story.tile)}</p>
        </div>
        <div className="rounded-xl border border-line p-3">
          <p className="text-xs text-muted">Status</p>
          <p className={clsx("mt-1 text-lg font-bold", good ? "text-success" : phase === "broken" ? "text-danger" : "text-warn")}>
            {good ? "All good" : phase === "broken" ? "Needs attention" : phase === "fixing" ? "Saathi is on it" : "With our team"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-heading">{story.panel.title}</p>
          <p className={clsx("text-sm", broken ? "text-danger" : "text-muted")}>{phase === "fixing" ? story.panel.broken : panelText}</p>
        </div>
        <span
          className={clsx(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
            good ? "bg-success text-white" : broken ? "bg-danger text-white" : "bg-warn text-white",
          )}
        >
          {good ? "OK" : broken ? "Problem" : "In progress"}
        </span>
      </div>
    </div>
  );
}

function Fix({ story, elapsed }: { story: Story; elapsed: number }) {
  const f = storyFrame(elapsed);
  return (
    <div data-theme="light" className="rounded-2xl border border-line bg-card p-4 text-ink shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">Saathi · what the merchant sees</p>
      <div className="mt-3 space-y-2 text-sm">
        <p className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-navy-2 px-3 py-2 text-white">{story.ask}</p>
        {f.typing && <p className="w-fit rounded-2xl bg-chat px-3 py-2 text-muted" aria-label="Saathi is typing">…</p>}
        {f.ack && <p className="max-w-[90%] rounded-2xl rounded-bl-sm bg-chat px-3 py-2">{story.ack}</p>}
        {f.reply && <p className="max-w-[90%] rounded-2xl rounded-bl-sm bg-chat px-3 py-2">{story.reply}</p>}
      </div>
      <ol className="mt-4 space-y-1.5 text-sm">
        {story.steps.map((s, i) => (
          <li key={s.kind} className={clsx("flex items-start gap-2", f.steps[i] === "pending" && "text-muted")}>
            <span className="mt-0.5 shrink-0">
              {f.steps[i] === "done" ? (
                <Check className="h-4 w-4 text-success" aria-hidden />
              ) : f.steps[i] === "running" ? (
                <Loader2 className="h-4 w-4 animate-spin text-navy-2" aria-hidden />
              ) : (
                <span className="block h-4 w-4 rounded-full border border-line" />
              )}
            </span>
            <span>
              <span className="font-semibold text-heading">{s.kind}</span> · {s.text}
            </span>
          </li>
        ))}
      </ol>
      {f.verified && (
        <p className="mt-3 flex items-center gap-1.5 rounded-lg bg-success/10 px-3 py-2 text-sm font-semibold text-success">
          <BadgeCheck className="h-4 w-4" aria-hidden />
          {story.needsApproval ? "Evidence ready for a person to decide" : "Proved by re-reading the system"}
          {story.proof.length > 0 && <span className="font-normal"> · {story.proof.map((p) => `${p.label} ${p.ref}`).join(" · ")}</span>}
        </p>
      )}
    </div>
  );
}

export function PlayableStory() {
  const [id, setId] = useState(STORIES[0].id);
  const [phase, setPhase] = useState<Phase>("healthy");
  const [elapsed, setElapsed] = useState(0);
  const reduced = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => false);
  const story = STORIES.find((s) => s.id === id) ?? STORIES[0];
  const act = (a: Parameters<typeof nextPhase>[1]) => setPhase((p) => nextPhase(p, a, story));
  const fix = () => {
    if (reduced) {
      setElapsed(FIX_MS);
      setPhase((p) => nextPhase(nextPhase(p, "fix", story), "done", story));
    } else act("fix");
  };

  useEffect(() => {
    if (phase !== "fixing") return;
    const start = Date.now();
    const t = setInterval(() => {
      const e = Date.now() - start;
      setElapsed(e);
      if (e >= FIX_MS) {
        clearInterval(t);
        setPhase((p) => nextPhase(p, "done", story));
      }
    }, 100);
    return () => clearInterval(t);
  }, [phase, story]);

  const pick = (next: Story["id"]) => {
    setId(next);
    setPhase("healthy");
    setElapsed(0);
  };
  const showFix = phase === "fixing" || phase === "fixed" || phase === "approved";

  return (
    <section id="story" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold uppercase tracking-wide text-eyebrow">Try it yourself</p>
        <h2 className="mt-2 text-3xl font-bold tracking-tight text-heading md:text-4xl">Break something. Watch Saathi fix it.</h2>
        <p className="mt-3 text-muted">
          Pick a failure, break it, then let Saathi handle it. Sample data and a simulated back office, but the same
          steps the real agent runs: listen, look up, decide, act, prove.
        </p>
      </div>

      <div role="group" aria-label="Pick a failure" className="mt-8 flex flex-wrap gap-2">
        {STORIES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === id}
            onClick={() => pick(s.id)}
            className={clsx(
              "rounded-full border px-4 py-2 text-sm font-semibold transition",
              s.id === id ? "border-navy-2 bg-navy-2 text-white" : "border-line bg-card text-heading hover:border-navy-2",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Dashboard story={story} phase={phase} />
        {showFix ? (
          <Fix story={story} elapsed={elapsed} />
        ) : (
          <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">
            {phase === "healthy" ? "Everything is running. Break something to see what happens." : "A merchant is stuck. Let Saathi take this one."}
          </div>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3" aria-live="polite">
        {phase === "healthy" && (
          <button type="button" onClick={() => act("break")} className="inline-flex items-center gap-2 rounded-lg bg-danger px-5 py-2.5 font-semibold text-white">
            <AlertTriangle className="h-4 w-4" aria-hidden /> {story.breakLabel}
          </button>
        )}
        {phase === "broken" && (
          <button type="button" onClick={fix} className="inline-flex items-center gap-2 rounded-lg bg-navy-2 px-5 py-2.5 font-semibold text-white">
            <Wrench className="h-4 w-4" aria-hidden /> Resolve with Saathi
          </button>
        )}
        {phase === "fixing" && <p className="text-sm font-semibold text-muted">Saathi is working…</p>}
        {phase === "fixed" && story.needsApproval && (
          <button type="button" onClick={() => act("approve")} className="inline-flex items-center gap-2 rounded-lg bg-navy-2 px-5 py-2.5 font-semibold text-white">
            <ShieldCheck className="h-4 w-4" aria-hidden /> Approve as the risk team
          </button>
        )}
        {phase === "fixed" && !story.needsApproval && <p className="text-sm font-semibold text-success">Fixed and proved.</p>}
        {phase === "approved" && <p className="text-sm font-semibold text-success">A person made the final call. Saathi only prepared the evidence.</p>}
        {phase !== "healthy" && phase !== "fixing" && (
          <button type="button" onClick={() => { setPhase("healthy"); setElapsed(0); }} className="inline-flex items-center gap-2 rounded-lg border border-line bg-card px-4 py-2.5 font-semibold text-heading">
            <RotateCcw className="h-4 w-4" aria-hidden /> Start over
          </button>
        )}
      </div>
    </section>
  );
}
