import { NextResponse } from "next/server";

/**
 * DEMO ONLY. Plays the role of "the host application's backend": it holds the host key and
 * mints merchant tokens, plus signs in the seeded demo staff. Disabled unless DEMO_MODE=true.
 * In a real Paytm integration only the merchant-token minting exists, in Paytm's own backend.
 */
const API = process.env.SAATHI_API_URL ?? "http://localhost:8000";

async function json<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, { ...init, cache: "no-store" });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

// Staff sessions last an hour; reuse them instead of logging in on every page load.
const STAFF_TTL_MS = 15 * 60 * 1000;
let staffCache: { at: number; value: { risk: unknown; admin: unknown } } | null = null;

export async function POST() {
  if (process.env.DEMO_MODE !== "true") return NextResponse.json({ error: "demo disabled" }, { status: 404 });
  const hostKey = process.env.SAATHI_HOST_API_KEY;
  if (!hostKey) return NextResponse.json({ error: "SAATHI_HOST_API_KEY is not set" }, { status: 500 });
  const password = process.env.SAATHI_DEMO_PASSWORD ?? "saathi-demo";
  try {
    const merchants = await json<{ id: number; name: string; language: string }[]>("/v1/demo/merchants", {
      headers: { "X-Saathi-Host-Key": hostKey },
    });
    const withTokens = await Promise.all(
      merchants.map(async (m) => {
        const t = await json<{ token: string }>("/v1/embed/token", {
          method: "POST",
          headers: { "X-Saathi-Host-Key": hostKey, "Content-Type": "application/json" },
          body: JSON.stringify({ merchant_id: m.id, language: m.language }),
        });
        return { ...m, token: t.token };
      }),
    );
    const login = (email: string) =>
      json<{ token: string; user: unknown }>("/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    if (!staffCache || Date.now() - staffCache.at > STAFF_TTL_MS) {
      const [risk, admin] = await Promise.all([login("risk@paytm.demo"), login("admin@paytm.demo")]);
      staffCache = { at: Date.now(), value: { risk, admin } };
    }
    return NextResponse.json({ merchants: withTokens, staff: staffCache.value }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    staffCache = null;
    return NextResponse.json({ error: "Could not reach the Saathi API. Is it running?" }, { status: 502 });
  }
}
