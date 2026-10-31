from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

from app.domain.types import Intent

Lang = Literal["hi", "hinglish", "en"]


class ParsedCase(BaseModel):
    model_config = ConfigDict(extra="forbid")

    intent: Intent
    summary: str = Field(max_length=240)
    claimed_amount_inr: Decimal | None = None
    injection_suspected: bool = False


class Understanding(BaseModel):
    """Output contract for the Understand step, from the LLM or the keyword fallback."""

    model_config = ConfigDict(extra="forbid")

    language: Lang
    cases: list[ParsedCase] = Field(max_length=4)
    legal_mention: bool = False
    sensitive_shared: bool = False  # merchant typed a PIN/OTP/card number
    confidence: float = Field(ge=0, le=1)
    mode: Literal["claude", "sarvam", "keyword"] = "keyword"
    ai_cost_inr: Decimal = Decimal("0")
