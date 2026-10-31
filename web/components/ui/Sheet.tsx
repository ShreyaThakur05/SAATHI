"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

/** A bottom sheet on phones, a centred panel on larger screens. Built on the native <dialog>. */
export function Sheet({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-label={title}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none rounded-t-3xl border border-line bg-card p-0 text-ink shadow-2xl backdrop:bg-navy/50 sm:m-auto sm:max-w-md sm:rounded-3xl"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <button onClick={onClose} aria-label="Close" className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-surface">
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <div className="overflow-y-auto px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">{children}</div>
    </dialog>
  );
}
