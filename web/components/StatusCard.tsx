"use client";

import clsx from "clsx";
import { CheckCircle2, Clock3, FileUp, ShieldAlert, UserRound } from "lucide-react";
import { useState } from "react";
import { ApiError } from "@/lib/api";
import { itemText, t, uploadLabel } from "@/lib/i18n";
import type { ChatCard, Lang } from "@/lib/types";

const STATE = {
  resolved: { icon: CheckCircle2, cls: "text-success", ring: "border-success/30 bg-success/5" },
  escalated: { icon: UserRound, cls: "text-warn", ring: "border-warn/30 bg-warn/5" },
  waiting: { icon: Clock3, cls: "text-brand-ink", ring: "border-brand/40 bg-brand/10" },
  blocked: { icon: ShieldAlert, cls: "text-danger", ring: "border-danger/30 bg-danger/5" },
} as const;

export function StatusCard({
  card,
  lang,
  onUpload,
}: {
  card: ChatCard;
  lang: Lang;
  onUpload?: (caseId: number, docType: string) => Promise<void>;
}) {
  const s = STATE[card.state];
  const Icon = s.icon;
  const [sent, setSent] = useState<Record<number, "busy" | "done" | string>>({});

  async function upload(caseId: number, docType: string) {
    if (!onUpload) return;
    setSent((p) => ({ ...p, [caseId]: "busy" }));
    try {
      await onUpload(caseId, docType);
      setSent((p) => ({ ...p, [caseId]: "done" }));
    } catch (e) {
      setSent((p) => ({ ...p, [caseId]: e instanceof ApiError ? e.message : "Upload failed" }));
    }
  }

  const empty = !card.items.length && !card.uploads.length;
  if (empty && card.state === "resolved") return null;
  return (
    <div className={clsx("mt-2 rounded-xl border p-3 text-sm", s.ring)}>
      <p className={clsx("flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide", !empty && "mb-1.5", s.cls)}>
        <Icon className="size-4" aria-hidden /> {t(card.state, lang)}
      </p>
      <ul className={clsx("space-y-1", empty && "hidden")}>
        {card.items.map((i) => (
          <li key={i.ref} className="flex items-center justify-between gap-3">
            <span className="text-ink">{itemText(i.label, lang)}</span>
            <span className="flex items-center gap-2">
              <code className="rounded bg-card px-1.5 py-0.5 text-xs font-semibold text-ink ring-1 ring-line">{i.ref}</code>
              {i.note && <span className={clsx("text-xs font-semibold", s.cls)}>{itemText(i.note, lang)}</span>}
            </span>
          </li>
        ))}
      </ul>
      {card.uploads.map((u) => {
        const state = sent[u.case_id];
        return (
          <div key={u.case_id} className="mt-2">
            <button
              type="button"
              disabled={state === "busy" || state === "done"}
              onClick={() => upload(u.case_id, u.doc_type)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-navy-2 px-3 py-2 text-sm font-semibold text-white hover:bg-navy disabled:opacity-60"
            >
              <FileUp className="size-4" aria-hidden />
              {state === "done" ? t("uploaded", lang) : uploadLabel(u.doc_type, lang)}
            </button>
            {state && state !== "busy" && state !== "done" && (
              <p role="alert" className="mt-1 text-xs text-danger">{state}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
