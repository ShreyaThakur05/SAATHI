"use client";

import clsx from "clsx";
import { Loader2, Mic, MicOff, SendHorizontal, Volume2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, merchantApi } from "@/lib/api";
import { SAMPLE_PROMPTS, t } from "@/lib/i18n";
import type { ChatMessage, Lang } from "@/lib/types";
import { useSpeech } from "@/lib/useSpeech";
import { Logo } from "./Logo";
import { StatusCard } from "./StatusCard";

interface Props {
  token: string;
  lang: Lang;
  onLangChange?: (l: Lang) => void;
  onHostEvent?: (type: string, payload?: Record<string, unknown>) => void;
  onActivity?: (caseIds: number[]) => void;
  /** A one-tap suggested message shown first on an empty chat. */
  suggested?: string;
  /** Sends this message once, as soon as the conversation history has loaded. */
  autoSend?: { id: number; text: string } | null;
  onClose?: () => void;
  className?: string;
}

const LANGS: { id: Lang; label: string }[] = [
  { id: "hi", label: "हिं" },
  { id: "hinglish", label: "Hinglish" },
  { id: "en", label: "EN" },
];

export function ChatPanel({ token, lang, onLangChange, onHostEvent, onActivity, suggested, autoSend, onClose, className }: Props) {
  const api = useMemo(() => merchantApi(token), [token]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const handledAuto = useRef<number | null>(null);
  const [offline, setOffline] = useState(false);
  const convoId = useRef<number | null>(null);
  const lastId = useRef(0);
  const loadedLang = useRef<Lang | null>(null);
  const awaitingAfter = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const hostEvent = useRef(onHostEvent);
  const activity = useRef(onActivity);
  useEffect(() => {
    hostEvent.current = onHostEvent;
    activity.current = onActivity;
  });

  const handleAuthError = useCallback((e: unknown) => {
    if (e instanceof ApiError && e.status === 401) {
      setExpired(true);
      hostEvent.current?.("saathi:token-expired");
      return true;
    }
    return false;
  }, []);

  // Poll for new messages (the ack and the final result arrive asynchronously).
  useEffect(() => {
    let stop = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        // After a language switch, reload the whole conversation: the server re-renders Saathi's
        // replies in the chosen language, so nothing stays behind in the old one.
        const since = loadedLang.current === lang ? lastId.current : 0;
        const fresh = await api.messages(since, lang);
        loadedLang.current = lang;
        setOffline(false);
        setLoaded(true);
        if (since === 0) setMessages(fresh);
        if (fresh.length) {
          lastId.current = fresh[fresh.length - 1].id;
          convoId.current = fresh[0].conversation_id;
          if (since !== 0) setMessages((prev) => [...prev, ...fresh.filter((m) => !prev.some((p) => p.id === m.id))]);
          const done = fresh.find((m) => m.role === "SAATHI" && m.card && (awaitingAfter.current === null || m.id > awaitingAfter.current));
          if (done?.card) {
            setWorking(false);
            awaitingAfter.current = null;
            hostEvent.current?.("saathi:case-update", { state: done.card.state, case_ids: done.card.case_ids });
          }
        }
      } catch (e) {
        if (!handleAuthError(e)) setOffline(true);
      }
      if (!stop) timer = setTimeout(tick, working ? 700 : 2000);
    };
    tick();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [api, working, lang, handleAuthError]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, working]);
  useEffect(() => {
    hostEvent.current?.("saathi:ready");
  }, []);

  const send = useCallback(
    async (raw: string, mode: "text" | "voice" = "text") => {
      const value = raw.trim();
      if (!value || working) return;
      setError(null);
      setText("");
      setWorking(true);
      try {
        const res = await api.send(value, mode, convoId.current);
        convoId.current = res.conversation_id;
        awaitingAfter.current = res.message_id;
        hostEvent.current?.("saathi:message-sent", { case_ids: res.case_ids });
        activity.current?.(res.case_ids);
        if (res.case_ids.length === 0) {
          setTimeout(() => setWorking(false), 1200);
          awaitingAfter.current = null;
        }
      } catch (e) {
        setWorking(false);
        setText(value);
        if (!handleAuthError(e)) setError(e instanceof ApiError ? e.message : t("sendFailed", lang));
      }
    },
    [api, working, lang, handleAuthError],
  );

  // Safety net: never leave the spinner on forever.
  useEffect(() => {
    if (!working) return;
    const id = setTimeout(() => setWorking(false), 90_000);
    return () => clearTimeout(id);
  }, [working]);

  // Context-aware help: the dashboard can ask Saathi something on the merchant's behalf.
  useEffect(() => {
    if (!autoSend || !loaded || working || handledAuto.current === autoSend.id) return;
    handledAuto.current = autoSend.id;
    void send(autoSend.text);
  }, [autoSend, loaded, working, send]);

  const speech = useSpeech(lang, (spoken) => send(spoken, "voice"));
  const empty = messages.length === 0;

  return (
    <div className={clsx("flex h-full min-h-0 flex-col bg-chat", className)} lang={lang === "en" ? "en" : "hi"}>
      <header className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
        <Logo size={36} className="rounded-full bg-card p-0.5" />
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-sm font-semibold">{t("title", lang)}</h1>
          <p className="truncate text-xs text-white/70">{t("subtitle", lang)}</p>
        </div>
        <div role="group" aria-label="Language" className="flex rounded-full bg-white/10 p-0.5 text-[11px] font-semibold">
          {LANGS.map((l) => (
            <button key={l.id} onClick={() => onLangChange?.(l.id)} aria-pressed={lang === l.id} className={clsx("rounded-full px-2 py-1", lang === l.id ? "bg-card text-heading" : "text-white/80")}>
              {l.label}
            </button>
          ))}
        </div>
        {onClose && (
          <button onClick={onClose} aria-label="Close chat" className="rounded-full p-1.5 text-white/80 hover:bg-white/10">
            <X className="size-4" aria-hidden />
          </button>
        )}
      </header>

      {(offline || expired) && (
        <p role="status" className={clsx("px-4 py-1.5 text-center text-xs font-medium", expired ? "bg-danger/10 text-danger" : "bg-warn/10 text-warn")}>
          {expired ? t("expired", lang) : t("offline", lang)}
        </p>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4" role="log" aria-live="polite" aria-label="Conversation">
        {empty && (
          <div className="mx-auto max-w-xs space-y-3 pt-6 text-center">
            <p className="text-sm text-muted">{t("neverAsk", lang)}</p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{t("tryAsking", lang)}</p>
            {[...(suggested ? [suggested] : []), ...SAMPLE_PROMPTS[lang].filter((p) => p !== suggested)].slice(0, suggested ? 1 : 3).map((p) => (
              <button key={p} onClick={() => send(p)} className="block w-full rounded-xl bg-card px-3 py-2 text-left text-sm text-ink shadow-sm ring-1 ring-line hover:ring-navy-2">
                {p}
              </button>
            ))}
          </div>
        )}
        <ul className="space-y-2">
          {messages.map((m) => (
            <li key={m.id} className={clsx("animate-in flex", m.role === "MERCHANT" ? "justify-end" : "justify-start")}>
              <div className={clsx("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm", m.role === "MERCHANT" ? "rounded-br-sm bg-bubble text-ink" : "rounded-bl-sm bg-card text-ink")}>
                {m.input_mode === "voice" && (
                  <span className="mb-0.5 flex items-center gap-1 text-[11px] font-medium text-muted"><Volume2 className="size-3" aria-hidden />Voice note</span>
                )}
                <p className="whitespace-pre-line leading-relaxed">{m.text}</p>
                {m.card && <StatusCard card={m.card} lang={lang} onUpload={async (cid, doc) => { await api.uploadDocument(cid, doc); }} />}
                <time className="mt-1 block text-right text-[10px] text-muted" dateTime={m.created_at}>
                  {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                </time>
              </div>
            </li>
          ))}
          {working && (
            <li className="flex justify-start" aria-label={t("working", lang)}>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-sm bg-card px-3.5 py-2.5 text-xs text-muted shadow-sm">
                <span className="flex gap-1" aria-hidden>
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="size-1.5 rounded-full bg-muted" style={{ animation: `saathi-dot 1s ${i * 0.15}s infinite` }} />
                  ))}
                </span>
                {t("working", lang)}
              </div>
            </li>
          )}
        </ul>
        <div ref={endRef} />
      </div>

      {error && <p role="alert" className="bg-danger/10 px-4 py-1.5 text-xs text-danger">{error}</p>}
      {speech.error === "mic-denied" && <p role="alert" className="bg-warn/10 px-4 py-1.5 text-xs text-warn">Microphone access is blocked. Allow it in your browser, or type your message.</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
        className="flex items-center gap-2 border-t border-line bg-card px-3 py-2.5"
      >
        <button
          type="button"
          disabled={!speech.supported || working || expired}
          onClick={speech.listening ? speech.stop : speech.start}
          aria-label={speech.supported ? (speech.listening ? "Stop recording" : "Record a voice note") : t("micOff", lang)}
          title={speech.supported ? undefined : t("micOff", lang)}
          className={clsx("flex size-10 shrink-0 items-center justify-center rounded-full", speech.listening ? "bg-danger text-white" : "bg-brand text-brand-ink", "disabled:opacity-40")}
          style={speech.listening ? { animation: "saathi-pulse 1s infinite" } : undefined}
        >
          {speech.supported ? <Mic className="size-5" aria-hidden /> : <MicOff className="size-5" aria-hidden />}
        </button>
        <input
          value={speech.listening ? speech.interim : text}
          onChange={(e) => setText(e.target.value)}
          readOnly={speech.listening}
          maxLength={1000}
          disabled={expired}
          placeholder={speech.listening ? t("listening", lang) : t("placeholder", lang)}
          aria-label={t("placeholder", lang)}
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm focus:border-navy-2 focus:outline-none"
        />
        <button type="submit" disabled={!text.trim() || working || expired} aria-label={t("send", lang)} className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy-2 text-white hover:bg-navy disabled:opacity-40">
          {working ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <SendHorizontal className="size-5" aria-hidden />}
        </button>
      </form>
      <p className="bg-card pb-2 text-center text-[11px] text-muted">{t("person", lang)}</p>
    </div>
  );
}
