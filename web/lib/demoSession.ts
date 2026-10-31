"use client";

import { useQuery } from "@tanstack/react-query";
import { saveSession } from "./auth";
import type { Lang, StaffUser } from "./types";

export interface DemoMerchant {
  id: number;
  name: string;
  language: Lang;
  token: string;
}
export interface DemoSession {
  merchants: DemoMerchant[];
  staff: { risk: { token: string; user: StaffUser }; admin: { token: string; user: StaffUser } };
}

const REFRESH_MS = 20 * 60 * 1000; // merchant tokens last 30 minutes

async function fetchDemoSession(): Promise<DemoSession> {
  const res = await fetch("/api/demo/session", { method: "POST" });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error ?? "Demo session failed");
  saveSession(body.staff.risk); // live panels reuse the console components as the risk approver
  return body as DemoSession;
}

/** Signs the demo in (merchant tokens + a risk approver) and re-mints before expiry. */
export function useDemoSession() {
  const q = useQuery({
    queryKey: ["demo-session"],
    queryFn: fetchDemoSession,
    refetchInterval: REFRESH_MS,
    staleTime: REFRESH_MS,
    retry: 1,
  });
  return { session: q.data ?? null, error: q.isError ? q.error.message : null, reload: () => q.refetch() };
}
