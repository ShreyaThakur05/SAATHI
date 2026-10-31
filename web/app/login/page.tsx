"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, Field, inputClass } from "@/components/ui/primitives";
import { ApiError, merchantLogin } from "@/lib/api";
import { saveMerchantSession, useMerchant } from "@/lib/merchantAuth";

const DEMO = [
  ["ramesh@store.example", "Ramesh General Store", "Soundbox offline"],
  ["seema@store.example", "Seema Boutique", "Card machine offline"],
  ["anil@store.example", "Anil Electronics", "Settlement on hold"],
  ["priya@store.example", "Priya Mobile Recharge", "Failed bill payment"],
] as const;

export default function MerchantLogin() {
  const router = useRouter();
  const { session } = useMerchant();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session) router.replace("/app");
  }, [session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      saveMerchantSession(await merchantLogin(email.trim(), password));
      router.replace("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-2xl font-bold text-navy">Business dashboard</p>
          <p className="mt-1 text-sm text-muted">Sign in to manage your devices, settlements and payments.</p>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-2xl border border-line bg-white p-6 shadow-sm">
          <Field label="Email">
            <input className={inputClass} type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <Field label="Password" error={error ?? undefined}>
            <input className={inputClass} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
          </Field>
          <Button type="submit" loading={busy} className="w-full">Sign in</Button>
        </form>
        <details className="mt-4 rounded-xl border border-line bg-white p-4 text-sm">
          <summary className="cursor-pointer font-medium text-ink">Sandbox accounts</summary>
          <p className="mt-2 text-xs text-muted">Fictional merchants, each with a different situation. Password for all: <code className="rounded bg-surface px-1">saathi-demo</code></p>
          <ul className="mt-2 space-y-1.5">
            {DEMO.map(([mail, name, note]) => (
              <li key={mail}>
                <button type="button" className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-surface" onClick={() => { setEmail(mail); setPassword("saathi-demo"); }}>
                  <span className="block font-medium text-ink">{name}</span>
                  <span className="block text-xs text-muted">{mail} · {note}</span>
                </button>
              </li>
            ))}
          </ul>
        </details>
        <p className="mt-6 text-center text-xs text-muted">
          Support team? <Link href="/console" className="font-semibold text-navy-2 hover:underline">Open the team console</Link>
        </p>
      </div>
    </main>
  );
}
