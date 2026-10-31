import logging
from typing import Any

import httpx

from app.ai.claude import understand_with_claude
from app.ai.keyword import extract_amount, looks_like_instruction, understand_keywords
from app.ai.pii import mask
from app.ai.sarvam import understand_with_sarvam
from app.ai.schemas import ParsedCase, Understanding
from app.core.config import Settings
from app.domain.types import Intent

log = logging.getLogger(__name__)


def understand(
    raw_text: str,
    settings: Settings,
    client: Any | None = None,
    provider: str | None = None,
) -> Understanding:
    """The configured LLM (Sarvam or Claude), schema-validated, else the keyword fallback.

    Safety net: whatever the model says, a message that looks like an instruction to move
    money is flagged, and PIN/OTP sharing is detected from the raw text.
    `client` lets tests inject a fake transport; an injected client with no explicit provider
    is treated as the Claude client (kept for existing tests).
    """
    masked, sensitive = mask(raw_text)
    chosen = provider or ("anthropic" if client is not None else settings.resolved_provider())
    result: Understanding | None = None
    if chosen != "none":
        try:
            if chosen == "sarvam":
                result = understand_with_sarvam(
                    masked, settings, client if isinstance(client, httpx.Client) else None
                )
            else:
                result = understand_with_claude(masked, settings, client)
        except Exception:  # noqa: BLE001 - any model/API/validation failure degrades safely
            log.warning("understand_llm_failed_fallback_to_keyword", exc_info=True)
    if result is None:
        result = understand_keywords(raw_text)
    elif looks_like_instruction(masked) and not any(c.injection_suspected for c in result.cases):
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
