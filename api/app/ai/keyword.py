"""Deterministic fallback for Understand: rules over Hindi, Hinglish and English text.

Used when no LLM key is configured, when the LLM fails or times out, and as the
reference the eval set is run against. Labelled mode="keyword" everywhere it shows.
"""

import re
from decimal import Decimal

from app.ai.pii import mask
from app.ai.schemas import Lang, ParsedCase, Understanding
from app.domain.types import Intent

PROBLEM = (
    "band",
    "bandh",
    "not working",
    "nahi chal",
    "kaam nahi",
    "offline",
    "silent",
    "chup",
    "no sound",
    "बंद",
    "काम नहीं",
    "नहीं चल",
    "बजता नहीं",
    "आवाज़ नहीं",
    "awaaz nahi",
    "stopped",
    "dead",
    "hang",
    "pair",
    "connect",
    "swipe nahi",
    "error",
    "खराब",
    "kharab",
)
SOUNDBOX = ("soundbox", "sound box", "speaker", "साउंडबॉक्स", "साउंड बॉक्स", "साउंडबाक्स")
CARD = ("card machine", "pos machine", "pos", "card reader", "swipe", "कार्ड मशीन", "पीओएस", "edc")
RENT = ("rent", "kiraya", "kiraye", "rental", "किराया", "किराये", "भाड़ा")
SETTLEMENT = (
    "settlement",
    "payout",
    "सेटलमेंट",
    "settle",
    "hold par",
    "ruka hua",
    "रुका",
    "paise nahi aaye",
    "paisa nahi aaya",
    "पैसे नहीं आए",
    "पैसा नहीं आया",
    "amount nahi aaya",
    "kyc",
)
BILL = (
    "bill",
    "recharge",
    "bijli",
    "electricity",
    "dth",
    "biller",
    "बिल",
    "रिचार्ज",
    "बिजली",
    "postpaid",
    "fastag",
    "gas",
)
BILL_PROBLEM = (
    "fail",
    "nahi hua",
    "nahin hua",
    "kat gaya",
    "kat gaye",
    "debit",
    "deduct",
    "kata",
    "paise kat",
    "pending",
    "फेल",
    "नहीं हुआ",
    "कट गया",
    "कट गए",
    "कटे",
    "refund",
    "wapas",
    "वापस",
    "not done",
    "didn't go",
    "not received",
    "nahi gaya",
)
UPI = ("upi", "यूपीआई", "gpay", "phonepe transfer")
LOAN = ("loan", "emi", "लोन", "ईएमआई")
LEGAL = (
    "legal",
    "lawyer",
    "court",
    "consumer forum",
    "rbi",
    "police",
    "notice",
    "advocate",
    "वकील",
    "कानूनी",
    "अदालत",
    "पुलिस",
    "ombudsman",
)

# Romanised-Hindi tokens. One strong token is enough; weak ones need two.
HINGLISH_STRONG = frozenset(
    [
        "hai",
        "hain",
        "nahi",
        "nahin",
        "kat",
        "gaya",
        "gayi",
        "gaye",
        "hua",
        "hui",
        "kya",
        "aur",
        "mera",
        "meri",
        "mere",
        "bhi",
        "raha",
        "rahi",
        "rha",
        "rhi",
        "kaise",
        "namaste",
        "karo",
        "kyun",
        "kyon",
        "abhi",
        "paise",
        "paisa",
        "wapas",
        "ruka",
        "hoon",
        "bhej",
    ]
)
HINGLISH_WEAK = frozenset(
    ["ho", "din", "se", "ka", "ki", "ke", "ko", "mein", "par", "tak", "kab", "kar"]
)

_AMOUNT = re.compile(
    r"(?:₹|rs\.?|inr)\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:rupees?|rupaye|rs\b|रुपये|₹)", re.I
)
_NUMBER_WORDS = {
    "one": 1,
    "two": 2,
    "three": 3,
    "four": 4,
    "five": 5,
    "six": 6,
    "seven": 7,
    "eight": 8,
    "nine": 9,
    "ten": 10,
    "ek": 1,
    "do": 2,
    "teen": 3,
    "char": 4,
    "paanch": 5,
    "panch": 5,
    "chhe": 6,
    "saat": 7,
    "aath": 8,
    "nau": 9,
    "das": 10,
}
_WORD_AMOUNT = re.compile(
    r"\b(" + "|".join(_NUMBER_WORDS) + r")\s+(thousand|hazaar|hazar|lakh)\b", re.I
)
_INSTRUCTION = [
    re.compile(
        r"(?i)ignore\s+(all\s+|the\s+|any\s+|previous\s+|above\s+|your\s+)*"
        r"(instructions?|rules?|limits?|guidelines?)"
    ),
    re.compile(r"(?i)(system\s*prompt|developer\s*mode|jailbreak|you\s+are\s+now)"),
    re.compile(
        r"(?i)(override|bypass|skip|disable)\s+(the\s+)?(limit|rule|check|verification|approval)"
    ),
    re.compile(r"(?i)\b(as|i\s*am|main)\s+(an?\s+)?(admin|paytm\s+(employee|staff|manager))\b"),
    re.compile(
        r"(?i)(approve|authori[sz]e)\s+(it|this|my\s+refund|karo)\s*(now|abhi|immediately)?"
    ),
]
_MONEY_MOVE = re.compile(
    r"(?i)\b(refund|reverse|transfer|credit|bhej\s*do|bhejo|de\s*do|dedo|return)\b"
)
_URGENT = re.compile(r"(?i)\b(now|abhi|turant|immediately|right\s+away|urgently)\b|तुरंत|अभी")
_AMOUNT_HINT = re.compile(r"(?i)(₹|\brs\.?\b|rupees?|rupaye|रुपये|thousand|hazaar|hazar|lakh|\d{3,})")


def detect_language(text: str) -> Lang:
    letters = [c for c in text if c.isalpha()]
    if letters and sum("ऀ" <= c <= "ॿ" for c in letters) / len(letters) > 0.3:
        return "hi"
    tokens = set(re.findall(r"[a-z]+", text.lower()))
    if tokens & HINGLISH_STRONG or len(tokens & HINGLISH_WEAK) >= 2:
        return "hinglish"
    return "en"


def extract_amount(text: str) -> Decimal | None:
    m = _AMOUNT.search(text)
    if m:
        return Decimal((m.group(1) or m.group(2)).replace(",", ""))
    w = _WORD_AMOUNT.search(text)
    if w:
        mult = {"thousand": 1000, "hazaar": 1000, "hazar": 1000, "lakh": 100000}[w.group(2).lower()]
        return Decimal(_NUMBER_WORDS[w.group(1).lower()] * mult)
    return None


def looks_like_instruction(text: str) -> bool:
    if any(p.search(text) for p in _INSTRUCTION):
        return True
    return bool(_MONEY_MOVE.search(text) and _URGENT.search(text) and _AMOUNT_HINT.search(text))


def _has(text: str, words: tuple[str, ...]) -> bool:
    return any(w in text for w in words)


def understand_keywords(raw_text: str) -> Understanding:
    text, sensitive = mask(raw_text)
    lowered = text.lower()
    language = detect_language(text)
    amount = extract_amount(text)
    cases: list[ParsedCase] = []

    def add(intent: Intent, summary: str) -> None:
        cases.append(ParsedCase(intent=intent, summary=summary, claimed_amount_inr=amount))

    injection = looks_like_instruction(text)
    has_problem = _has(lowered, PROBLEM)
    if _has(lowered, SOUNDBOX) and has_problem:
        add(Intent.DEVICE_FAULT, "Soundbox not working")
    if _has(lowered, RENT):
        add(Intent.RENT_DISPUTE, "Rent charged")
    if _has(lowered, CARD) and has_problem:
        add(Intent.CARD_MACHINE_ISSUE, "Card machine problem")
    if _has(lowered, SETTLEMENT):
        add(Intent.SETTLEMENT_HELD, "Settlement not received / on hold")
    if _has(lowered, BILL) and _has(lowered, BILL_PROBLEM):
        add(Intent.BILL_PAYMENT_FAILED, "Bill payment failed, money debited")
    if _has(lowered, UPI):
        add(Intent.UPI_ISSUE, "UPI payment issue")
    if _has(lowered, LOAN):
        add(Intent.LOAN_QUERY, "Loan query")

    if injection:
        cases.append(
            ParsedCase(
                intent=Intent.UNSUPPORTED,
                summary="Instruction to move money, not a claim",
                claimed_amount_inr=amount,
                injection_suspected=True,
            )
        )
    return Understanding(
        language=language,
        cases=cases[:4],
        legal_mention=_has(lowered, LEGAL),
        sensitive_shared=sensitive,
        confidence=0.9 if cases else 0.2,
        mode="keyword",
    )
