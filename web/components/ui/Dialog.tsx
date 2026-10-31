"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

export function Dialog({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
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
      aria-labelledby="dialog-title"
      className="m-auto w-[min(92vw,28rem)] rounded-xl border border-line bg-card p-0 text-ink shadow-xl backdrop:bg-navy/40"
    >
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 id="dialog-title" className="text-sm font-semibold">
          {title}
        </h2>
        <button onClick={onClose} aria-label="Close" className="rounded p-1 text-muted hover:bg-surface">
          <X className="size-4" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
