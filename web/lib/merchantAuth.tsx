"use client";

import { useQuery, type QueryKey } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { ApiError, merchantApi } from "./api";
import type { Lang } from "./types";

const KEY = "saathi.merchant";
const EVENT = "saathi:merchant-auth";

export interface MerchantSession {
  token: string;
  merchant: { id: number; name: string; language: Lang };
}

let cached: { raw: string | null; parsed: MerchantSession | null } = { raw: null, parsed: null };

function read(): MerchantSession | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(KEY);
  if (raw !== cached.raw) {
    let parsed: MerchantSession | null = null;
    try {
      parsed = raw ? (JSON.parse(raw) as MerchantSession) : null;
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

export function saveMerchantSession(s: MerchantSession) {
  window.sessionStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new Event(EVENT));
}

export function clearMerchantSession() {
  window.sessionStorage.removeItem(KEY);
  window.dispatchEvent(new Event(EVENT));
}

export function useMerchant() {
  const session = useSyncExternalStore(subscribe, read, () => null);
  const ready = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const api = useMemo(() => (session ? merchantApi(session.token) : null), [session]);
  const logout = useCallback(() => clearMerchantSession(), []);
  return { session, merchant: session?.merchant ?? null, token: session?.token ?? null, ready, api, logout };
}

/** useQuery for dashboard data; signs the merchant out if the token is no longer valid. */
export function useMerchantQuery<T>(
  key: QueryKey,
  fn: (api: ReturnType<typeof merchantApi>) => Promise<T>,
  opts: { refetchInterval?: number | false } = {},
) {
  const { api, token } = useMerchant();
  const q = useQuery({
    queryKey: ["m", token, ...key],
    queryFn: () => fn(api as ReturnType<typeof merchantApi>),
    enabled: !!api,
    refetchInterval: opts.refetchInterval ?? 5000,
  });
  const unauthorized = q.error instanceof ApiError && q.error.status === 401;
  useEffect(() => {
    if (unauthorized) clearMerchantSession();
  }, [unauthorized]);
  return q;
}
