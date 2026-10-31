"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { API_URL } from "./config";
import type { CaseDetail, Step } from "./types";

/** Parse one SSE frame ("event: x\ndata: {...}") */
export function parseSse(frame: string): { event: string; data: unknown } | null {
  let event = "message";
  let data = "";
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return null;
  try {
    return { event, data: JSON.parse(data) };
  } catch {
    return null;
  }
}

/**
 * Streams new steps for a case into the React Query cache as the server writes them.
 * EventSource can't send an Authorization header, so this uses fetch + a stream reader.
 */
export function useCaseStream(caseId: number | null, token: string | null, active: boolean) {
  const qc = useQueryClient();
  useEffect(() => {
    if (!caseId || !token || !active) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch(`${API_URL}/v1/cases/${caseId}/stream`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) return;
        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += value;
          let i: number;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const msg = parseSse(buf.slice(0, i));
            buf = buf.slice(i + 2);
            if (!msg) continue;
            if (msg.event === "step") {
              const step = msg.data as Step;
              qc.setQueryData<CaseDetail>(["case", caseId], (old) =>
                old && !old.steps.some((s) => s.seq === step.seq) ? { ...old, steps: [...old.steps, step] } : old,
              );
            } else if (msg.event === "done") {
              qc.invalidateQueries({ queryKey: ["case", caseId] });
              return;
            }
          }
        }
      } catch {
        /* aborted or network drop: polling keeps the page correct */
      }
    })();
    return () => ctrl.abort();
  }, [caseId, token, active, qc]);
}
