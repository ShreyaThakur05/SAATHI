"use client";

import { CheckCircle2, Info, X } from "lucide-react";
import { createContext, useCallback, useContext, useState } from "react";

interface Toast {
  id: number;
  title: string;
  body?: string;
  tone: "success" | "info";
}

const Ctx = createContext<(t: Omit<Toast, "id">) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 7000);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed bottom-4 left-4 z-50 flex w-[min(22rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : Info;
          return (
            <div key={t.id} className="animate-in pointer-events-auto flex items-start gap-3 rounded-xl border border-line bg-card p-3 shadow-lg">
              <Icon className={t.tone === "success" ? "mt-0.5 size-5 text-success" : "mt-0.5 size-5 text-link"} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{t.title}</p>
                {t.body && <p className="text-sm text-muted">{t.body}</p>}
              </div>
              <button aria-label="Dismiss" onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="rounded p-1 text-muted hover:bg-surface">
                <X className="size-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
