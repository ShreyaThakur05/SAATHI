"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ChatPanel } from "@/components/ChatPanel";
import { parseEmbedHash } from "@/lib/embed";
import type { Lang } from "@/lib/types";

const subscribe = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

/**
 * Embeddable merchant chat. The host passes a short-lived token in the URL hash
 * (never sent to any server), e.g. /chat#token=...&lang=hi&primary=%230a7cff&host=https://dashboard.example
 */
export default function ChatPage() {
  const hash = useSyncExternalStore(
    subscribe,
    () => window.location.hash,
    () => null,
  );
  const params = useMemo(() => (hash === null ? null : parseEmbedHash(hash)), [hash]);
  const [chosen, setChosen] = useState<Lang | null>(null);
  const lang = chosen ?? params?.lang ?? "hinglish";
  const primary = params?.primary ?? null;

  useEffect(() => {
    if (primary) document.documentElement.style.setProperty("--brand", primary);
  }, [primary]);

  if (!params) return null;
  if (!params.token) {
    return (
      <main className="flex h-screen items-center justify-center p-6 text-center text-sm text-muted">
        This chat needs a session token from the host application.
      </main>
    );
  }
  const host = params.hostOrigin;
  return (
    <div className="h-dvh">
      <ChatPanel
        token={params.token}
        lang={lang}
        onLangChange={setChosen}
        onHostEvent={(type, payload) => {
          if (host && window.parent !== window) window.parent.postMessage({ source: "saathi", type, ...payload }, host);
        }}
      />
    </div>
  );
}
