"use client";

import clsx from "clsx";
import { Sparkles } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMerchant } from "@/lib/merchantAuth";
import type { Lang } from "@/lib/types";
import { ChatPanel } from "./ChatPanel";

interface DockApi {
  /** Open the chat and send this message for the merchant (context-aware help). */
  ask: (text: string) => void;
  open: () => void;
}

const Ctx = createContext<DockApi>({ ask: () => {}, open: () => {} });
export const useSaathi = () => useContext(Ctx);

export function SaathiProvider({ children, busyCount }: { children: React.ReactNode; busyCount: number }) {
  const { token, merchant } = useMerchant();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState<{ id: number; text: string } | null>(null);
  const [lang, setLang] = useState<Lang>(merchant?.language ?? "hinglish");

  const ask = useCallback((text: string) => {
    setPending({ id: Date.now(), text });
    setIsOpen(true);
  }, []);
  const open = useCallback(() => setIsOpen(true), []);
  const api = useMemo(() => ({ ask, open }), [ask, open]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  return (
    <Ctx.Provider value={api}>
      {children}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          aria-label="Ask Saathi for help"
          className="fixed bottom-5 right-5 z-30 flex items-center gap-2 rounded-full bg-navy-2 py-3 pl-4 pr-5 text-sm font-semibold text-white shadow-xl hover:bg-navy"
        >
          <Sparkles className="size-4 text-brand" aria-hidden />
          Ask Saathi
          {busyCount > 0 && (
            <span className="ml-1 rounded-full bg-brand px-1.5 text-[11px] font-bold text-brand-ink" aria-label={`${busyCount} requests in progress`}>
              {busyCount}
            </span>
          )}
        </button>
      )}
      <div
        className={clsx("fixed inset-0 z-40 bg-navy/40 sm:hidden", isOpen ? "block" : "hidden")}
        onClick={() => setIsOpen(false)}
        aria-hidden
      />
      {isOpen && token && (
        <aside role="dialog" aria-label="Saathi help chat" className="fixed inset-y-0 right-0 z-40 flex w-full flex-col overflow-hidden bg-white shadow-2xl sm:w-[26rem] sm:border-l sm:border-line">
          <ChatPanel token={token} lang={lang} onLangChange={setLang} autoSend={pending} onClose={() => setIsOpen(false)} className="h-full" />
        </aside>
      )}
    </Ctx.Provider>
  );
}
