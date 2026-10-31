"use client";

import clsx from "clsx";
import { Headset, Mic, MicOff, SendHorizontal, Sparkles, Store, X } from "lucide-react";
import Link from "next/link";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { GREETING, replyTo, STARTERS, type Cta } from "@/lib/landingAgent";
import { useSpeech } from "@/lib/useSpeech";
import { Logo } from "./Logo";

interface Msg {
  id: number;
  role: "agent" | "you";
  text: string;
  ctas?: Cta[];
}

interface Ctx {
  messages: Msg[];
  typing: boolean;
  panelOpen: boolean;
  setPanelOpen: (v: boolean) => void;
  send: (text: string) => void;
}

const AgentCtx = createContext<Ctx | null>(null);
const useAgent = () => {
  const c = useContext(AgentCtx);
  if (!c) throw new Error("LandingAgentProvider is missing");
  return c;
};

/** One conversation shared by the inline section and the floating launcher. */
export function LandingAgentProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Msg[]>([{ id: 0, role: "agent", text: GREETING }]);
  const [typing, setTyping] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const nextId = useRef(1);
  const turns = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const send = useCallback((raw: string) => {
    const text = raw.trim().slice(0, 500);
    if (!text) return;
    const turn = turns.current++;
    setMessages((m) => [...m, { id: nextId.current++, role: "you", text }]);
    setTyping(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const r = replyTo(text, turn);
      setMessages((m) => [...m, { id: nextId.current++, role: "agent", text: r.text, ctas: r.ctas }]);
      setTyping(false);
    }, 650);
  }, []);

  const value = useMemo(() => ({ messages, typing, panelOpen, setPanelOpen, send }), [messages, typing, panelOpen, send]);
  return <AgentCtx.Provider value={value}>{children}</AgentCtx.Provider>;
}

function Ctas({ ctas }: { ctas: Cta[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {ctas.includes("merchant") && (
        <Link href="/login" className="inline-flex items-center gap-1.5 rounded-full bg-navy-2 px-4 py-2 text-sm font-semibold text-white hover:bg-navy">
          <Store className="size-4" aria-hidden /> Merchant sign in
        </Link>
      )}
      {ctas.includes("console") && (
        <Link href="/console" className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-navy-2 ring-1 ring-line hover:bg-surface">
          <Headset className="size-4" aria-hidden /> Team console sign in
        </Link>
      )}
    </div>
  );
}

function AgentChat({ className, idPrefix }: { className?: string; idPrefix: string }) {
  const { messages, typing, send } = useAgent();
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeech("hinglish", (spoken) => send(spoken));

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages, typing]);

  const fresh = messages.length === 1;
  return (
    <div className={clsx("flex min-h-0 flex-col bg-[#eef3f9]", className)}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4" role="log" aria-live="polite" aria-label="Conversation with Saathi">
        <ul className="space-y-2.5">
          {messages.map((m) => (
            <li key={m.id} className={clsx("flex gap-2", m.role === "you" ? "justify-end" : "justify-start")}>
              {m.role === "agent" && <Logo size={28} className="mt-1 shrink-0 self-start rounded-full bg-white p-0.5" />}
              <div className={clsx("max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm", m.role === "you" ? "rounded-br-sm bg-[#d8f1fc] text-ink" : "rounded-bl-sm bg-white text-ink")}>
                {m.text}
                {m.ctas && <Ctas ctas={m.ctas} />}
              </div>
            </li>
          ))}
          {typing && (
            <li className="flex gap-2" aria-label="Saathi is typing">
              <Logo size={28} className="mt-1 shrink-0 self-start rounded-full bg-white p-0.5" />
              <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-white px-4 py-3 shadow-sm" aria-hidden>
                {[0, 1, 2].map((i) => <span key={i} className="size-1.5 rounded-full bg-muted" style={{ animation: `saathi-dot 1s ${i * 0.15}s infinite` }} />)}
              </div>
            </li>
          )}
        </ul>
        {fresh && (
          <div className="mt-4 flex flex-wrap gap-2">
            {STARTERS.map((s) => (
              <button key={s} type="button" onClick={() => send(s)} className="rounded-full bg-white px-3.5 py-1.5 text-sm text-ink shadow-sm ring-1 ring-line hover:ring-navy-2">
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={endRef} />
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
          setText("");
        }}
        className="flex items-center gap-2 border-t border-line bg-white px-3 py-2.5"
      >
        <button
          type="button"
          disabled={!speech.supported}
          onClick={speech.listening ? speech.stop : speech.start}
          aria-label={speech.supported ? (speech.listening ? "Stop recording" : "Speak to Saathi") : "Voice is not available in this browser"}
          className={clsx("flex size-10 shrink-0 items-center justify-center rounded-full disabled:opacity-40", speech.listening ? "bg-danger text-white" : "bg-brand text-brand-ink")}
        >
          {speech.supported ? <Mic className="size-5" aria-hidden /> : <MicOff className="size-5" aria-hidden />}
        </button>
        <input
          id={`${idPrefix}-input`}
          value={speech.listening ? speech.interim : text}
          onChange={(e) => setText(e.target.value)}
          readOnly={speech.listening}
          maxLength={500}
          placeholder={speech.listening ? "Listening…" : "Tell Saathi what's wrong…"}
          aria-label="Message to Saathi"
          className="h-10 min-w-0 flex-1 rounded-full border border-line bg-surface px-4 text-sm focus:border-navy-2 focus:outline-none"
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send message" className="flex size-10 shrink-0 items-center justify-center rounded-full bg-navy-2 text-white hover:bg-navy disabled:opacity-40">
          <SendHorizontal className="size-5" aria-hidden />
        </button>
      </form>
    </div>
  );
}

/** The in-page "talk to Saathi" card. */
export function AgentInline() {
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-white shadow-xl shadow-navy/5">
      <div className="flex items-center gap-3 bg-navy px-5 py-3.5 text-white">
        <Logo size={40} className="rounded-full bg-white p-0.5" />
        <div>
          <p className="font-semibold leading-tight">Saathi</p>
          <p className="flex items-center gap-1.5 text-xs text-white/70"><span className="size-1.5 rounded-full bg-success" aria-hidden />Online · Hindi, Hinglish, English</p>
        </div>
      </div>
      <AgentChat className="h-[26rem]" idPrefix="inline" />
    </div>
  );
}

/** The floating agent, available anywhere on the page. */
export function AgentLauncher() {
  const { panelOpen, setPanelOpen, messages } = useAgent();
  useEffect(() => {
    if (!panelOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPanelOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, setPanelOpen]);
  const unread = !panelOpen && messages.length > 1 && messages[messages.length - 1].role === "agent";
  return (
    <>
      {!panelOpen && (
        <button onClick={() => setPanelOpen(true)} aria-label="Chat with Saathi" className="fixed bottom-5 right-5 z-40 flex items-center gap-2.5 rounded-full bg-navy-2 py-2.5 pl-2.5 pr-5 text-sm font-semibold text-white shadow-xl shadow-navy-2/30 hover:bg-navy">
          <Logo size={34} className="rounded-full bg-white p-0.5" />
          Chat with Saathi
          {unread && <span className="size-2.5 rounded-full bg-brand" aria-label="New reply" />}
        </button>
      )}
      {panelOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-navy/40 sm:hidden" onClick={() => setPanelOpen(false)} aria-hidden />
          <aside role="dialog" aria-label="Chat with Saathi" className="fixed inset-y-0 right-0 z-50 flex w-full flex-col overflow-hidden bg-white shadow-2xl sm:inset-y-auto sm:bottom-5 sm:right-5 sm:h-[34rem] sm:w-[24rem] sm:rounded-3xl sm:border sm:border-line">
            <div className="flex items-center gap-3 bg-navy px-4 py-3 text-white">
              <Logo size={36} className="rounded-full bg-white p-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold leading-tight">Saathi</p>
                <p className="flex items-center gap-1.5 text-xs text-white/70"><Sparkles className="size-3" aria-hidden />Sign in to get help with your account</p>
              </div>
              <button onClick={() => setPanelOpen(false)} aria-label="Close chat" className="rounded-full p-1.5 text-white/80 hover:bg-white/10"><X className="size-4" aria-hidden /></button>
            </div>
            <AgentChat className="min-h-0 flex-1" idPrefix="panel" />
          </aside>
        </>
      )}
    </>
  );
}
