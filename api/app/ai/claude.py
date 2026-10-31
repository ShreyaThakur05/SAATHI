import logging
from decimal import Decimal
from typing import Any

import anthropic

from app.ai.prompts import UNDERSTAND_SYSTEM
from app.ai.schemas import Understanding
from app.core.config import Settings

log = logging.getLogger(__name__)

TOOL_NAME = "record_understanding"


def _tool_schema() -> dict[str, Any]:
    schema = Understanding.model_json_schema()
    for server_owned in ("mode", "ai_cost_inr"):
        schema["properties"].pop(server_owned, None)
    return {
        "name": TOOL_NAME,
        "description": "Record the structured understanding of the merchant message.",
        "input_schema": schema,
    }


def understand_with_claude(
    masked_text: str, settings: Settings, client: Any | None = None
) -> Understanding:
    """Call the model, validate against the schema, or raise. Callers fall back on error."""
    llm: Any = client
    if llm is None:
        assert settings.anthropic_api_key is not None
        llm = anthropic.Anthropic(
            api_key=settings.anthropic_api_key.get_secret_value(),
            timeout=settings.llm_timeout_s,
            max_retries=1,
        )
    response = llm.messages.create(
        model=settings.understand_model,
        max_tokens=600,
        temperature=0,
        system=UNDERSTAND_SYSTEM,
        tools=[_tool_schema()],
        tool_choice={"type": "tool", "name": TOOL_NAME},
        messages=[
            {
                "role": "user",
                "content": f"<merchant_message>{masked_text}</merchant_message>",
            }
        ],
    )
    block = next((b for b in response.content if b.type == "tool_use"), None)
    if block is None:
        raise ValueError("model returned no tool call")
    usd = (
        response.usage.input_tokens * settings.llm_input_usd_per_mtok
        + response.usage.output_tokens * settings.llm_output_usd_per_mtok
    ) / 1_000_000
    parsed = Understanding.model_validate(
        {**block.input, "mode": "claude", "ai_cost_inr": Decimal(str(usd * settings.usd_inr))}
    )
    return parsed
