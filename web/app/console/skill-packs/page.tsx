"use client";

import { Code2, ShieldCheck, UserCheck } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Card, ErrorState, Skeleton } from "@/components/ui/primitives";
import { useStaff, useStaffQuery } from "@/lib/auth";
import { formatInr, humanize } from "@/lib/format";
import type { SkillPack } from "@/lib/types";

function PackCard({ p }: { p: SkillPack }) {
  const [showYaml, setShowYaml] = useState(false);
  const roadmap = p.status === "roadmap";
  return (
    <Card className="flex flex-col">
      <header className="flex items-start justify-between gap-3 p-4">
        <div>
          <h2 className="text-base font-semibold">{p.title}</h2>
          <p className="font-mono text-xs text-muted">{p.skill_pack}@v{p.version}</p>
        </div>
        <Badge tone={roadmap ? "neutral" : "success"}>{roadmap ? "roadmap" : "live"}</Badge>
      </header>
      {roadmap ? (
        <p className="px-4 pb-4 text-sm text-muted">Defined in the deck as next. Cases for this product are handed to a person today.</p>
      ) : (
        <div className="space-y-4 px-4 pb-4 text-sm">
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><ShieldCheck className="size-3.5" aria-hidden />Saathi does on its own</h3>
            <ul className="space-y-1">
              {p.allowed_actions.filter((a) => !p.requires_person.includes(a)).map((a) => (
                <li key={a} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{humanize(a)}</span>
                  {p.action_limits_inr[a] && <Badge tone="dark">up to {formatInr(p.action_limits_inr[a])}</Badge>}
                  <span className="text-xs text-muted">proof: {p.proof[a]}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted"><UserCheck className="size-3.5" aria-hidden />Needs a person</h3>
            <ul className="space-y-1">
              {p.requires_person.map((a) => <li key={a}>{humanize(a)} (always)</li>)}
              {p.hand_off_if.map((h) => <li key={h}>{humanize(h)}{h === "repeat_claim" ? ` (after ${p.max_prior_claims} prior)` : ""}</li>)}
              {Object.keys(p.action_limits_inr).length > 0 && <li>Any amount above its limit</li>}
            </ul>
          </section>
        </div>
      )}
      <footer className="mt-auto border-t border-line px-4 py-2">
        <Button variant="ghost" className="h-8 px-2 text-xs" onClick={() => setShowYaml((v) => !v)} aria-expanded={showYaml}>
          <Code2 className="size-3.5" aria-hidden /> {showYaml ? "Hide" : "View"} the Skill Pack file
        </Button>
        {showYaml && <pre className="mb-2 overflow-x-auto rounded-lg bg-navy p-3 font-mono text-xs leading-relaxed text-white/90">{p.source_yaml}</pre>}
      </footer>
    </Card>
  );
}

export default function SkillPacksPage() {
  const { api } = useStaff();
  const q = useStaffQuery(["skill-packs"], () => api.skillPacks());
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-heading">Skill Packs</h1>
        <p className="text-sm text-muted">One core, a small file per product. These files are what the rules engine actually reads.</p>
      </header>
      {q.isPending ? <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64" />)}</div> : q.isError ? <ErrorState message={q.error.message} onRetry={() => q.refetch()} /> : <div className="grid items-start gap-4 md:grid-cols-2">{q.data.map((p) => <PackCard key={p.skill_pack} p={p} />)}</div>}
    </div>
  );
}
