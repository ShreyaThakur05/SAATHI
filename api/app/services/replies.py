"""Customer-facing replies, built from verified system facts only.

Outcome text is templated on purpose: money and compliance statements must never be
free-text LLM output. Every template avoids promising settlement dates and never asks
for a PIN, OTP or card number (enforced by tests).
"""

from dataclasses import dataclass, field
from decimal import Decimal
from typing import Literal

Language = Literal["hi", "hinglish", "en"]
LANGUAGES: tuple[Language, ...] = ("hi", "hinglish", "en")

TEMPLATES: dict[str, dict[Language, str]] = {
    "device_already_online": {
        "hi": "आपका डिवाइस अभी ऑनलाइन है, कोई दिक्कत नहीं मिली।",
        "hinglish": "Aapka device abhi online hai, koi dikkat nahi mili.",
        "en": "Your device is online right now; we found no fault.",
    },
    "device_fixed_remote": {
        "hi": "आपका डिवाइस रिमोट रीस्टार्ट से वापस ऑनलाइन हो गया है।",
        "hinglish": "Aapka device remote restart se wapas online ho gaya hai.",
        "en": "Your device is back online after a remote restart.",
    },
    "device_replaced": {
        "hi": "रिमोट फिक्स काम नहीं आया, इसलिए नया डिवाइस भेज रहे हैं। नया डिवाइस {eta} तक पहुँच जाएगा।",
        "hinglish": "Remote fix kaam nahi aaya, isliye naya device bhej rahe hain. "
        "Naya device {eta} tak pahunch jayega.",
        "en": "The remote fix did not work, so we are sending a new device. "
        "It should reach you by {eta}.",
    },
    "rent_reversed": {
        "hi": "{days} दिन का किराया ₹{amount} वापस कर दिया है।",
        "hinglish": "{days} din ka rent ₹{amount} wapas kar diya hai.",
        "en": "We reversed ₹{amount} of rent for {days} down days.",
    },
    "rent_no_downtime": {
        "hi": "आपके डिवाइस का 1 दिन से ज़्यादा डाउनटाइम नहीं मिला, इसलिए किराया वापस नहीं बनता।",
        "hinglish": "Device ka 1 din se zyada downtime nahi mila, isliye rent wapas nahi banta.",
        "en": "We found less than one full day of downtime, so no rent reversal applies.",
    },
    "card_repaired": {
        "hi": "आपकी कार्ड मशीन दोबारा पेयर हो गई है और ऑनलाइन है।",
        "hinglish": "Aapki card machine dobara pair ho gayi hai aur online hai.",
        "en": "Your card machine is re-paired and online.",
    },
    "card_replaced": {
        "hi": "री-पेयर काम नहीं आया, इसलिए नई कार्ड मशीन भेज रहे हैं। यह {eta} तक पहुँच जाएगी।",
        "hinglish": "Re-pair kaam nahi aaya, isliye nayi card machine bhej rahe hain. "
        "Yeh {eta} tak pahunch jayegi.",
        "en": "Re-pairing did not work, so we are sending a new card machine by {eta}.",
    },
    "settlement_none": {
        "hi": "आपका कोई सेटलमेंट होल्ड पर नहीं मिला।",
        "hinglish": "Aapka koi settlement hold par nahi mila.",
        "en": "We found no settlement on hold for you.",
    },
    "settlement_need_doc": {
        "hi": "आपका सेटलमेंट होल्ड पर है। बस एक चीज़ चाहिए: {doc}। कृपया इसे अपलोड करें, बाकी सब हमारे पास है।",
        "hinglish": "Aapka settlement hold par hai. Bas ek cheez chahiye: {doc}. "
        "Kripya ise upload karein, baaki sab humare paas hai.",
        "en": "Your settlement is on hold. We only need one thing: {doc}. "
        "Please upload it; we already have everything else.",
    },
    "settlement_sent_to_risk": {
        "hi": "दस्तावेज़ मिल गया और सही है। केस हमारी रिस्क टीम को समीक्षा के लिए भेज दिया है। "
        "हम सेटलमेंट की तारीख का वादा नहीं कर सकते, पर अपडेट यहीं मिलेगा।",
        "hinglish": "Document mil gaya aur sahi hai. Case humari risk team ko review ke liye bhej "
        "diya hai. Hum settlement ki tarikh ka vaada nahi kar sakte, par update yahin milega.",
        "en": "Document received and verified. Your case is with our risk team for review. "
        "We cannot promise a settlement date, but you will get the update here.",
    },
    "settlement_released": {
        "hi": "हमारी टीम ने आपका सेटलमेंट होल्ड हटा दिया है।",
        "hinglish": "Humari team ne aapka settlement hold hata diya hai.",
        "en": "Our team has released the hold on your settlement.",
    },
    "bill_refunded": {
        "hi": "बिल पेमेंट फेल हुआ था। ₹{amount} का रिफंड हो गया है।",
        "hinglish": "Bill payment fail hua tha. ₹{amount} ka refund ho gaya hai.",
        "en": "Your bill payment had failed. We have refunded ₹{amount}.",
    },
    "handoff": {
        "hi": "यह केस हमारी टीम के एक व्यक्ति को भेज दिया है, सारी जानकारी के साथ। आपको यहीं अपडेट मिलेगा।",
        "hinglish": "Yeh case humari team ke ek vyakti ko bhej diya hai, saari jaankari ke saath. "
        "Aapko yahin update milega.",
        "en": "A person on our team now has your case with all the details. "
        "You will get the update here.",
    },
    "blocked_instruction": {
        "hi": "माफ़ कीजिए, मैं मैसेज में दिए गए निर्देश पर कोई रिफंड या बदलाव नहीं कर सकता। "
        "मैं सिर्फ़ आपके अकाउंट के रिकॉर्ड के आधार पर काम करता हूँ। ज़रूरत हो तो आप अपनी असली "
        "समस्या बताएँ।",
        "hinglish": "Maaf kijiye, main message mein diye gaye nirdesh par koi refund ya badlaav nahi "
        "kar sakta. Main sirf aapke account ke records ke aadhaar par kaam karta hoon. "
        "Zarurat ho to apni asli samasya batayein.",
        "en": "Sorry, I cannot refund or change anything because a message told me to. I only act "
        "on your account's records. Please describe the actual problem.",
    },
    "person_resolved": {
        "hi": "हमारी टीम ने आपका केस देख लिया है और बंद कर दिया है।",
        "hinglish": "Humari team ne aapka case dekh liya hai aur band kar diya hai.",
        "en": "Our team has reviewed your case and closed it.",
    },
    "sensitive_warning": {
        "hi": "सुरक्षा के लिए: कृपया PIN, OTP या कार्ड नंबर कभी साझा न करें। हम ये कभी नहीं मांगते। "
        "आपके मैसेज से यह जानकारी हटा दी गई है।",
        "hinglish": "Suraksha ke liye: kripya PIN, OTP ya card number kabhi share na karein. Hum yeh "
        "kabhi nahi maangte. Aapke message se yeh jaankari hata di gayi hai.",
        "en": "For your safety: never share a PIN, OTP or card number. We never ask for them. "
        "That information was removed from your message.",
    },
    "rejected": {
        "hi": "हमारी टीम ने समीक्षा के बाद यह अनुरोध स्वीकार नहीं किया। कारण: {note}",
        "hinglish": "Humari team ne review ke baad yeh request manzoor nahi ki. Karan: {note}",
        "en": "Our team reviewed this and could not approve it. Reason: {note}",
    },
    "unsupported": {
        "hi": "यह प्रोडक्ट अभी साथी से अपने-आप नहीं संभाला जाता। केस हमारी टीम को भेज दिया है।",
        "hinglish": "Yeh product abhi Saathi se automatic nahi hota. Case humari team ko bhej diya hai.",
        "en": "Saathi cannot handle this product yet. Your case has been sent to our team.",
    },
    "unclear": {
        "hi": "मैं समझ नहीं पाया। क्या आप बता सकते हैं कि समस्या Soundbox, कार्ड मशीन, "
        "सेटलमेंट या बिल पेमेंट में से किसमें है?",
        "hinglish": "Main samajh nahi paya. Kya aap bata sakte hain ki dikkat Soundbox, card machine, "
        "settlement ya bill payment mein se kis mein hai?",
        "en": "I could not tell what went wrong. Is it your Soundbox, card machine, "
        "settlement or a bill payment?",
    },
}

ACK = {
    "hi": "समझ गया। मैं {n} चीज़ें चेक कर रहा हूँ: {items}।",
    "hinglish": "Samajh gaya. Main {n} cheezein check kar raha hoon: {items}.",
    "en": "Got it. I am checking {n} things: {items}.",
}

ACK_ONE = {
    "hi": "समझ गया। मैं चेक कर रहा हूँ: {items}।",
    "hinglish": "Samajh gaya. Main check kar raha hoon: {items}.",
    "en": "Got it. Checking: {items}.",
}

INTENT_LABELS: dict[str, dict[Language, str]] = {
    "device_fault": {"hi": "आपका डिवाइस", "hinglish": "aapka device", "en": "your device"},
    "rent_dispute": {"hi": "किराये का चार्ज", "hinglish": "rent ka charge", "en": "the rent charge"},
    "card_machine_issue": {
        "hi": "आपकी कार्ड मशीन",
        "hinglish": "aapki card machine",
        "en": "your card machine",
    },
    "settlement_held": {
        "hi": "आपका सेटलमेंट",
        "hinglish": "aapka settlement",
        "en": "your settlement",
    },
    "bill_payment_failed": {
        "hi": "बिल पेमेंट",
        "hinglish": "bill payment",
        "en": "the bill payment",
    },
    "upi_issue": {"hi": "UPI पेमेंट", "hinglish": "UPI payment", "en": "the UPI payment"},
    "loan_query": {"hi": "लोन", "hinglish": "loan", "en": "the loan query"},
    "unsupported": {"hi": "आपका अनुरोध", "hinglish": "aapka request", "en": "your request"},
}

DOC_LABELS: dict[str, dict[Language, str]] = {
    "GST": {"hi": "GST प्रमाणपत्र", "hinglish": "GST certificate", "en": "GST certificate"},
    "PAN": {"hi": "PAN कार्ड", "hinglish": "PAN card", "en": "PAN card"},
    "BANK_PROOF": {"hi": "बैंक प्रूफ", "hinglish": "bank proof", "en": "bank proof"},
    "SHOP_PHOTO": {"hi": "दुकान की फोटो", "hinglish": "shop photo", "en": "shop photo"},
}

FORBIDDEN_SNIPPETS = ("otp bhej", "pin bhej", "share your otp", "share your pin", "card number de")


@dataclass
class CardItem:
    label: str
    ref: str
    note: str = ""


@dataclass
class Reply:
    key: str
    refs: dict[str, str] = field(default_factory=dict)
    items: list[CardItem] = field(default_factory=list)


def fmt_inr(value: object) -> str:
    """20.00 -> '20', 1840.50 -> '1840.5' (no trailing zeros, no exponent)."""
    d = Decimal(str(value)).normalize()
    return format(d, "f")


def render(reply: Reply, language: Language) -> str:
    template = TEMPLATES[reply.key][language]
    text = template.format_map(_Safe(reply.refs))
    lowered = text.lower()
    if any(bad in lowered for bad in FORBIDDEN_SNIPPETS):  # defence in depth
        raise ValueError(f"template {reply.key} violates reply guard")
    return text


def ack_text(intents: list[str], language: Language) -> str:
    labels = [INTENT_LABELS.get(i, INTENT_LABELS["unsupported"])[language] for i in intents]
    joiner = {"hi": " और ", "hinglish": " aur ", "en": " and "}[language]
    items = joiner.join(labels)
    template = ACK_ONE if len(labels) == 1 else ACK
    return template[language].format(n=len(labels), items=items)


def doc_label(doc_type: str, language: Language) -> str:
    return DOC_LABELS.get(doc_type, {}).get(language, doc_type)


class _Safe(dict[str, str]):
    def __missing__(self, key: str) -> str:
        return "-"
