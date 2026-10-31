"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { ApiError, staffApi } from "@/lib/api";
import { saveSession, useStaff } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const { session } = useStaff();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) router.replace("/console");
  }, [session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await staffApi(null).login(email.trim(), password);
      saveSession(res);
      router.replace("/console");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <ThemeToggle className="absolute right-4 top-4" />
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 rounded-2xl border border-line bg-card p-6 shadow-sm">
        <div>
          <Logo size={56} />
          <h1 className="mt-2 text-xl font-bold text-heading">Saathi console</h1>
          <p className="mt-1 text-sm text-muted">Sign in to review cases and approvals.</p>
        </div>
        <Field label="Email">
          <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" error={error ?? undefined}>
          <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
        <details className="rounded-lg bg-surface p-3 text-xs text-muted">
          <summary className="cursor-pointer font-medium text-ink">Demo accounts</summary>
          <ul className="mt-2 space-y-1">
            <li><button type="button" className="underline" onClick={() => { setEmail("risk@paytm.demo"); setPassword("saathi-demo"); }}>risk@paytm.demo</button> can approve</li>
            <li><button type="button" className="underline" onClick={() => { setEmail("agent@paytm.demo"); setPassword("saathi-demo"); }}>agent@paytm.demo</button> read-only</li>
            <li><button type="button" className="underline" onClick={() => { setEmail("admin@paytm.demo"); setPassword("saathi-demo"); }}>admin@paytm.demo</button> can also reset demo data</li>
          </ul>
        </details>
      </form>
    </main>
  );
}
