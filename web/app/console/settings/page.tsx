"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CircleSlash, FlaskConical } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Badge, Button, Card, CardHeader, ErrorState, Skeleton } from "@/components/ui/primitives";
import { ApiError } from "@/lib/api";
import { useStaff, useStaffQuery } from "@/lib/auth";

const KIND = {
  simulated: { label: "Simulated", tone: "warn" as const, icon: FlaskConical },
  live: { label: "Live", tone: "success" as const, icon: CheckCircle2 },
  not_configured: { label: "Not configured", tone: "neutral" as const, icon: CircleSlash },
};

export default function SettingsPage() {
  const { api, user } = useStaff();
  const qc = useQueryClient();
  const q = useStaffQuery(["system-status"], () => api.systemStatus());
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function reset() {
    setBusy(true);
    setMessage(null);
    try {
      await api.demoReset();
      qc.clear();
      setMessage({ ok: true, text: "Sandbox data was reset to the starting scenarios." });
      setConfirm(false);
    } catch (e) {
      setMessage({ ok: false, text: e instanceof ApiError ? e.message : "Reset failed" });
    } finally {
      setBusy(false);
    }
  }

  if (q.isPending) return <Skeleton className="mx-auto h-64 max-w-3xl" />;
  if (q.isError) return <ErrorState message={q.error.message} onRetry={() => q.refetch()} />;
  const s = q.data;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-muted">What this environment is connected to, stated plainly.</p>
      </header>

      <Card>
        <CardHeader title="Environment" />
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 p-4 text-sm sm:grid-cols-4">
          <div><dt className="text-xs text-muted">Environment</dt><dd className="font-medium capitalize">{s.env}</dd></div>
          <div><dt className="text-xs text-muted">Version</dt><dd className="font-medium">{s.version}</dd></div>
          <div><dt className="text-xs text-muted">System latency (simulated)</dt><dd className="font-medium">{s.sim_latency_ms} ms</dd></div>
          <div>
            <dt className="text-xs text-muted">Understanding</dt>
            <dd className="font-medium">{s.understanding.mode === "claude" ? `Claude (${s.understanding.model})` : "Keyword fallback"}</dd>
          </div>
        </dl>
        {s.understanding.mode === "keyword" && (
          <p className="border-t border-line px-4 py-3 text-sm text-muted">No model key is configured, so a deterministic keyword classifier reads merchant messages. It works for common phrasings and fails safe (an unrecognised message creates no case). Set <code className="rounded bg-surface px-1">SAATHI_ANTHROPIC_API_KEY</code> to use the language model.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Integrations" hint="Each connector sits behind an interface, so going live means swapping the implementation." />
        <ul>
          {s.integrations.map((i) => {
            const k = KIND[i.kind];
            return (
              <li key={i.name} className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 last:border-0">
                <div>
                  <p className="text-sm font-semibold text-ink">{i.name}</p>
                  <p className="text-xs text-muted">{i.detail}</p>
                </div>
                <Badge tone={k.tone}><k.icon className="size-3" aria-hidden />{k.label}</Badge>
              </li>
            );
          })}
        </ul>
      </Card>

      {s.demo_tools_enabled && (
        <Card className="border-warn/40">
          <CardHeader title="Sandbox data" hint="Wipes all cases, chats and audit entries, then restores the starting merchants and scenarios." />
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <p className="text-sm text-muted">{user?.role === "ADMIN" ? "Use this to start a clean walkthrough." : "Only an admin can reset sandbox data."}</p>
            <Button variant="danger" disabled={user?.role !== "ADMIN"} onClick={() => setConfirm(true)}>Reset sandbox data</Button>
          </div>
          {message && <p role={message.ok ? "status" : "alert"} className={message.ok ? "px-4 pb-4 text-sm text-success" : "px-4 pb-4 text-sm text-danger"}>{message.text}</p>}
        </Card>
      )}

      <Dialog open={confirm} onClose={() => setConfirm(false)} title="Reset sandbox data?">
        <p className="text-sm text-muted">This permanently deletes every case, conversation and audit entry in this sandbox. It cannot be undone.</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
          <Button variant="danger" loading={busy} onClick={reset}>Reset everything</Button>
        </div>
      </Dialog>
    </div>
  );
}
