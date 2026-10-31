/**
 * The landing-page Saathi. It runs entirely in the browser: no account access, no model call.
 * It acknowledges what the visitor describes, in their language, and asks them to sign in first,
 * because Saathi can only look at (and fix) an account it knows is theirs.
 */
export type Lang = "hi" | "hinglish" | "en";
export type Cta = "merchant" | "console";

export interface AgentReply {
  text: string;
  ctas: Cta[];
}

const HINGLISH = new Set(
  "hai hain nahi nahin kat gaya gayi gaye hua hui kya aur mera meri mere bhi raha rahi kaise namaste karo kyun abhi paise paisa wapas ruka hoon bhej band".split(" "),
);

export function detectLanguage(text: string): Lang {
  const letters = [...text].filter((c) => /\p{L}/u.test(c));
  if (letters.length && letters.filter((c) => c >= "ऀ" && c <= "ॿ").length / letters.length > 0.3) return "hi";
  const tokens = text.toLowerCase().match(/[a-z]+/g) ?? [];
  return tokens.some((t) => HINGLISH.has(t)) ? "hinglish" : "en";
}

type Topic = "soundbox" | "card" | "settlement" | "bill" | "rent" | "upi" | "loan";

const TOPIC_WORDS: [Topic, RegExp][] = [
  ["soundbox", /soundbox|sound box|speaker|साउंड/i],
  ["card", /card machine|\bpos\b|swipe|कार्ड मशीन/i],
  ["settlement", /settlement|payout|kyc|सेटलमेंट|पेआउट/i],
  ["bill", /\bbill\b|recharge|bijli|electricity|dth|बिल|रिचार्ज|बिजली/i],
  ["rent", /\brent\b|kiraya|किराया|किराये/i],
  ["upi", /\bupi\b|यूपीआई/i],
  ["loan", /\bloan\b|\bemi\b|लोन/i],
];

const TOPIC_LABEL: Record<Topic, Record<Lang, string>> = {
  soundbox: { hi: "आपके साउंडबॉक्स", hinglish: "aapke Soundbox", en: "your Soundbox" },
  card: { hi: "आपकी कार्ड मशीन", hinglish: "aapki card machine", en: "your card machine" },
  settlement: { hi: "आपके सेटलमेंट", hinglish: "aapke settlement", en: "your settlement" },
  bill: { hi: "आपके बिल पेमेंट", hinglish: "aapke bill payment", en: "your bill payment" },
  rent: { hi: "आपके किराये के चार्ज", hinglish: "aapke rent ke charge", en: "the rent charge" },
  upi: { hi: "आपके UPI पेमेंट", hinglish: "aapke UPI payment", en: "your UPI payment" },
  loan: { hi: "आपके लोन", hinglish: "aapke loan", en: "your loan" },
};

const TEAM = /support team|console|approv|\bagent\b|risk|\badmin\b|audit|team member|sapport|सपोर्ट|टीम/i;
const SENSITIVE = /\botp\b|\bpin\b|\bcvv\b|ओटीपी|पिन|\b\d{4,6}\b/i;

export const GREETING =
  "Hi, I'm Saathi. I fix problems with Paytm products: Soundbox, card machines, settlements and bill payments. Tell me what's wrong. I'll need you to sign in before I can look at your account.";

const T = {
  topic: {
    en: (t: string) => `I understand: it's about ${t}. To check it and fix it I need to know it's really your account, so please sign in first. I can't see anything about your account from this page.`,
    hinglish: (t: string) => `Samajh gaya, baat ${t} ki hai. Isse check karke fix karne ke liye mujhe pata hona chahiye ki yeh sach mein aapka account hai, isliye pehle sign in karein. Is page se main aapke account ka kuch nahi dekh sakta.`,
    hi: (t: string) => `समझ गया, बात ${t} की है। इसे जाँचने और ठीक करने के लिए मुझे पक्का पता होना चाहिए कि यह आपका ही अकाउंट है, इसलिए पहले साइन इन करें। इस पेज से मैं आपके अकाउंट का कुछ नहीं देख सकता।`,
  },
  generic: {
    en: "I'm here to help, but I can only act on your own account. Please sign in first, then tell me what went wrong in Hindi, Hinglish or English.",
    hinglish: "Main madad ke liye hoon, par main sirf aapke apne account par kaam kar sakta hoon. Pehle sign in karein, phir Hindi, Hinglish ya English mein bataiye kya dikkat hai.",
    hi: "मैं मदद के लिए हूँ, पर मैं सिर्फ़ आपके अपने अकाउंट पर काम कर सकता हूँ। पहले साइन इन करें, फिर हिंदी, हिंग्लिश या अंग्रेज़ी में बताइए क्या दिक्कत है।",
  },
  team: {
    en: "If you're on the support team, sign in to the team console to review cases, approve what Saathi has prepared, and read the audit log. Merchants sign in to their own dashboard.",
    hinglish: "Agar aap support team mein hain, to team console mein sign in karein: wahan cases, approvals aur audit log milte hain. Merchants apne dashboard mein sign in karte hain.",
    hi: "अगर आप सपोर्ट टीम में हैं, तो टीम कंसोल में साइन इन करें: वहाँ केस, अप्रूवल और ऑडिट लॉग मिलते हैं। मर्चेंट अपने डैशबोर्ड में साइन इन करते हैं।",
  },
  sensitive: {
    en: "Please don't share a PIN, OTP or card number here or anywhere else. Saathi never asks for them. To get help with your account, sign in first.",
    hinglish: "Kripya PIN, OTP ya card number yahan ya kahin bhi share na karein. Saathi yeh kabhi nahi maangta. Account ke liye madad chahiye to pehle sign in karein.",
    hi: "कृपया PIN, OTP या कार्ड नंबर यहाँ या कहीं भी साझा न करें। साथी ये कभी नहीं माँगता। अकाउंट में मदद के लिए पहले साइन इन करें।",
  },
  again: {
    en: "I'm ready as soon as you sign in. Then I can check your account and fix it.",
    hinglish: "Aap sign in karte hi main shuru kar dunga. Phir main aapka account check karke fix kar sakta hoon.",
    hi: "आप साइन इन करते ही मैं शुरू कर दूँगा। फिर मैं आपका अकाउंट जाँचकर ठीक कर सकता हूँ।",
  },
} as const;

/** `turn` is how many times the visitor has already written (0 for the first message). */
export function replyTo(message: string, turn: number): AgentReply {
  const text = message.trim();
  const lang = detectLanguage(text);
  if (SENSITIVE.test(text)) return { text: T.sensitive[lang], ctas: ["merchant"] };
  if (TEAM.test(text)) return { text: T.team[lang], ctas: ["console", "merchant"] };
  const topics = TOPIC_WORDS.filter(([, re]) => re.test(text)).map(([t]) => TOPIC_LABEL[t][lang]);
  if (topics.length) {
    const joiner = lang === "hi" ? " और " : lang === "hinglish" ? " aur " : " and ";
    return { text: T.topic[lang](topics.join(joiner)), ctas: ["merchant"] };
  }
  return { text: turn > 0 ? T.again[lang] : T.generic[lang], ctas: ["merchant"] };
}

export const STARTERS = ["My Soundbox is offline and rent was deducted", "Mera settlement ruka hua hai", "I'm on the support team"];
