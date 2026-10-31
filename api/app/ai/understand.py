import logging
from typing import Any

from app.ai.claude import understand_with_claude
from app.ai.keyword import looks_like_instruction, understand_keywords
from app.ai.pii import mask
from app.ai.schemas import Understanding
from app.core.config import Settings

log = logging.getLogger(__name__)


def understand(raw_text: str, settings: Settings, client: Any | None = None) -> Understanding:
    """Claude when configured (schema-validated), otherwise the keyword fallback.

    Safety net: whatever the model says, a message that looks like an instruction to move
    money is flagged, and PIN/OTP sharing is detected from the raw text.
    """
    masked, sensitive = mask(raw_text)
    result: Understanding | None = None
    if settings.anthropic_api_key is not None or client is not None:
        try:
            result = understand_with_claude(masked, settings, client)
        except Exception:  # noqa: BLE001 - any model/API/validation failure degrades safely
            log.warning("understand_llm_failed_fallback_to_keyword", exc_info=True)
    if result is None:
        result = understand_keywords(raw_text)
    elif looks_like_instruction(masked) and not any(c.injection_suspected for c in result.cases):
        from app.ai.keyword import extract_amount
        from app.ai.schemas import ParsedCase
        from app.domain.types import Intent

        result.cases.append(
            ParsedCase(
                intent=Intent.UNSUPPORTED,
                summary="Instruction to move money, not a claim",
                claimed_amount_inr=extract_amount(masked),
                injection_suspected=True,
            )
        )
    result.sensitive_shared = result.sensitive_shared or sensitive
    return result
