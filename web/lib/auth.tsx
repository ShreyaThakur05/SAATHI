"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { ApiError, staffApi } from "./api";
import type { StaffUser } from "./types";

const KEY = "saathi.staff";
const EVENT = "saathi:auth";

interface Session {
  token: string;
  user: StaffUser;
}

let cached: { raw: string | null; parsed: Session | null } = { raw: null, parsed: null };

function read(): Session | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (raw !== cached.raw) {
    let parsed: Session | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      parsed = null;
    }
    cached = { raw, parsed };
  }
  return cached.parsed;
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

export function saveSession(s: Session) {
  window.sessionStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVENT));
}

export function clearSession() {
  window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

/** `ready` is false during SSR/first paint so pages can avoid flashing a login redirect. */
export function useStaff() {
  const session = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const api = useMemo(() => staffApi(session?.token ?? null), [session?.token]);
  const logout = useCallback(() => clearSession(), []);
  return { session, user: session?.user ?? null, token: session?.token ?? null, ready, api, logout };
}

/** useQuery that signs the user out when the API says the token is no longer valid. */
export function useStaffQuery<T>(
  key: QueryKey,
  fn: () => Promise<T>,
  opts: { refetchInterval?: number | false; enabled?: boolean } = {},
) {
  const { token } = useStaff();
  const q = useQuery({
    queryKey: key,
    queryFn: fn,
    enabled: !!token && (opts.enabled ?? true),
    refetchInterval: opts.refetchInterval,
  });
  const unauthorized = q.error instanceof ApiError && q.error.status === 401;
  useEffect(() => {
    if (unauthorized) clearSession();
  }, [unauthorized]);
  return q;
}
