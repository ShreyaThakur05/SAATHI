import type { Lang } from "./types";

type Dict = Record<string, Record<Lang, string>>;

export const T: Dict = {
  title: { hi: "पेटीएम साथी", hinglish: "Paytm Saathi", en: "Paytm Saathi" },
  subtitle: {
    hi: "हर दिक्कत का हल, हर प्रोडक्ट पर",
    hinglish: "Har dikkat ka hal, har product par",
    en: "Every problem solved, on every product",
  },
  placeholder: { hi: "अपनी समस्या लिखें…", hinglish: "Apni dikkat likhein…", en: "Describe your problem…" },
  send: { hi: "भेजें", hinglish: "Bhejein", en: "Send" },
  working: { hi: "साथी काम कर रहा है…", hinglish: "Saathi kaam kar raha hai…", en: "Saathi is working on it…" },
  listening: { hi: "सुन रहा हूँ… बोलिए", hinglish: "Sun raha hoon… boliye", en: "Listening… speak now" },
  micOff: {
    hi: "इस ब्राउज़र में वॉइस उपलब्ध नहीं",
    hinglish: "Is browser mein voice available nahi",
    en: "Voice isn't available in this browser",
  },
  tryAsking: { hi: "ऐसे पूछ सकते हैं", hinglish: "Aise pooch sakte hain", en: "You can try" },
  uploadDoc: { hi: "{doc} अपलोड करें", hinglish: "{doc} upload karein", en: "Upload {doc}" },
  uploaded: { hi: "भेज दिया", hinglish: "Bhej diya", en: "Sent" },
  person: { hi: "टीम का व्यक्ति कभी भी जुड़ सकता है", hinglish: "Team ka vyakti kabhi bhi jud sakta hai", en: "A person can step in any time" },
  neverAsk: {
    hi: "हम कभी PIN या OTP नहीं मांगते",
    hinglish: "Hum kabhi PIN ya OTP nahi maangte",
    en: "We never ask for your PIN or OTP",
  },
  resolved: { hi: "हो गया", hinglish: "Ho gaya", en: "Done" },
  escalated: { hi: "टीम के पास", hinglish: "Team ke paas", en: "With our team" },
  waiting: { hi: "आपका इंतज़ार", hinglish: "Aapka intezaar", en: "Waiting for you" },
  blocked: { hi: "नहीं हो सका", hinglish: "Nahi ho saka", en: "Not done" },
  expired: {
    hi: "सेशन खत्म हो गया। कृपया पेज दोबारा खोलें।",
    hinglish: "Session khatam ho gaya. Kripya page dobara kholein.",
    en: "Your session expired. Please reopen this page.",
  },
  offline: {
    hi: "कनेक्शन में दिक्कत। दोबारा कोशिश कर रहे हैं…",
    hinglish: "Connection mein dikkat. Dobara koshish kar rahe hain…",
    en: "Connection problem. Retrying…",
  },
  sendFailed: { hi: "मैसेज नहीं भेजा जा सका", hinglish: "Message nahi bheja ja saka", en: "Couldn't send that message" },
};

export const t = (key: keyof typeof T, lang: Lang) => T[key][lang];

export const DOC_NAMES: Record<string, Record<Lang, string>> = {
  GST: { hi: "GST प्रमाणपत्र", hinglish: "GST certificate", en: "GST certificate" },
  PAN: { hi: "PAN कार्ड", hinglish: "PAN card", en: "PAN card" },
  BANK_PROOF: { hi: "बैंक प्रूफ", hinglish: "bank proof", en: "bank proof" },
  SHOP_PHOTO: { hi: "दुकान की फोटो", hinglish: "shop photo", en: "shop photo" },
};

export const uploadLabel = (docType: string, lang: Lang) =>
  T.uploadDoc[lang].replace("{doc}", DOC_NAMES[docType]?.[lang] ?? docType);

export const SAMPLE_PROMPTS: Record<Lang, string[]> = {
  hi: ["साउंडबॉक्स दो दिन से बंद है और किराया भी कट गया", "बिजली बिल का पेमेंट फेल हो गया, पैसे कट गए", "मेरा सेटलमेंट रुका हुआ है"],
  hinglish: [
    "Soundbox do din se band hai, aur rent bhi kat gaya.",
    "bijli bill ka payment fail ho gaya par paise kat gaye",
    "mera settlement ruka hua hai, paise nahi aaye",
  ],
  en: [
    "My soundbox stopped working and rent was still deducted",
    "Electricity bill payment failed but money was debited",
    "My settlement is on hold",
  ],
};
