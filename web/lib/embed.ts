import type { Lang } from "./types";

export interface EmbedParams {
  token: string | null;
  lang: Lang;
  primary: string | null;
  hostOrigin: string | null;
}

const HEX = /^#[0-9a-fA-F]{6}$/;
const LANGS: Lang[] = ["hi", "hinglish", "en"];

/** Parse #token=...&lang=...&primary=...&host=... from the URL hash (kept out of server logs). */
export function parseEmbedHash(hash: string): EmbedParams {
  const p = new URLSearchParams(hash.replace(/^#/, ""));
  const lang = p.get("lang") as Lang | null;
  const primary = p.get("primary");
  const host = p.get("host");
  let hostOrigin: string | null = null;
  if (host) {
    try {
      hostOrigin = new URL(host).origin;
    } catch {
      hostOrigin = null;
    }
  }
  return {
    token: p.get("token"),
    lang: lang && LANGS.includes(lang) ? lang : "hinglish",
    primary: primary && HEX.test(primary) ? primary : null,
    hostOrigin,
  };
}
