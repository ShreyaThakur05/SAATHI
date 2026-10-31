"""Mask personal and sensitive data before any model sees it or it is stored."""

import re

_RULES: list[tuple[str, re.Pattern[str]]] = [
    ("[OTP]", re.compile(r"(?i)\b(otp|pin|cvv|पिन|ओटीपी)\b[\s:=\-is]*\d{3,8}")),
    ("[CARD]", re.compile(r"\b\d(?:[ -]?\d){12,18}\b")),
    ("[AADHAAR]", re.compile(r"\b\d{4}\s\d{4}\s\d{4}\b")),
    ("[PHONE]", re.compile(r"(?<!\d)(?:\+?91[-\s]?)?[6-9]\d{9}(?!\d)")),
    ("[ACCOUNT]", re.compile(r"(?<![\w-])\d{9,18}(?![\w-])")),
    ("[PAN]", re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")),
]
_SENSITIVE = {"[OTP]", "[CARD]"}


def mask(text: str) -> tuple[str, bool]:
    """Return (masked text, whether a PIN/OTP/card number was shared)."""
    sensitive = False
    for token, pattern in _RULES:
        text, n = pattern.subn(token, text)
        if n and token in _SENSITIVE:
            sensitive = True
    return text, sensitive
