"""Understand via Sarvam's chat completions API (https://docs.sarvam.ai).

Same contract as the Claude path: the model returns a record, we validate it against the
Understanding schema, and any failure raises so the caller falls back to keywords.
"""

import json
import re
from decimal import Decimal
from typing import Any

import httpx

from app.ai.prompts import UNDERSTAND_SYSTEM
from app.ai.schemas import Understanding
from app.core.config import Settings

_THINK = re.compile(r"<think>.*?</think>", re.DOTALL)
_FENCE = re.compile(r"^```(?:json)?\s*|\s*```$", re.IGNORECASE)


def _schema() -> dict[str, Any]:
    schema = Understanding.model_json_schema()
    for server_owned in ("mode", "ai_cost_inr"):
        schema["properties"].pop(server_owned, None)
    return schema


def parse_model_json(content: str | None) -> dict[str, Any]:
    """Models sometimes wrap JSON in code fences or leave a <think> block; tolerate both."""
    if not content:
        raise ValueError("model returned no content")
    text = _FENCE.sub("", _THINK.sub("", content).strip()).strip()
    data = json.loads(text)
    if not isinstance(data, dict):
        raise ValueError("model JSON is not an object")
    return data


def understand_with_sarvam(
    masked_text: str, settings: Settings, client: httpx.Client | None = None
) -> Understanding:
    """Call Sarvam, validate against the schema, or raise. Callers fall back on error."""
    assert settings.sarvam_api_key is not None
    key = settings.sarvam_api_key.get_secret_value()
    payload = {
        "model": settings.sarvam_model,
        "temperature": 0,
        "max_tokens": 600,
        "reasoning_effort": settings.sarvam_reasoning_effort,
        "messages": [
            {"role": "system", "content": UNDERSTAND_SYSTEM},
            {"role": "user", "content": f"<merchant_message>{masked_text}</merchant_message>"},
        ],
        "response_format": {
            "type": "json_schema",
            "json_schema": {"name": "understanding", "schema": _schema(), "strict": False},
        },
    }
    # The docs list both headers; sending both is the documented safe choice.
    headers = {"Authorization": f"Bearer {key}", "api-subscription-key": key}
    owned = client is None
    http = client or httpx.Client(timeout=settings.llm_timeout_s)
    try:
        res = http.post(
            f"{settings.sarvam_base_url.rstrip('/')}/v1/chat/completions",
            json=payload,
            headers=headers,
        )
        res.raise_for_status()
        body = res.json()
    finally:
        if owned:
            http.close()
    content = body["choices"][0]["message"].get("content")
    usage = body.get("usage") or {}
    usd = (
        usage.get("prompt_tokens", 0) * settings.llm_input_usd_per_mtok
        + usage.get("completion_tokens", 0) * settings.llm_output_usd_per_mtok
    ) / 1_000_000
    return Understanding.model_validate(
        {
            **parse_model_json(content),
            "mode": "sarvam",
            "ai_cost_inr": Decimal(str(usd * settings.usd_inr)),
        }
    )
