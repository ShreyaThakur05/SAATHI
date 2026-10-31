import json
from typing import Any

import httpx
import pytest

from app.ai.sarvam import parse_model_json, understand_with_sarvam
from app.ai.understand import understand
from app.core.config import Settings

VALID = {
    "language": "hinglish",
    "cases": [{"intent": "device_fault", "summary": "Soundbox down"}],
    "legal_mention": False,
    "sensitive_shared": False,
    "confidence": 0.9,
}


def settings(**kw: Any) -> Settings:
    base: dict[str, Any] = {
        "sarvam_api_key": "sk_test_123",
        "llm_input_usd_per_mtok": 1,
        "llm_output_usd_per_mtok": 2,
    }
    return Settings(**{**base, **kw})


def client_returning(
    content: str | None, status: int = 200, seen: list[httpx.Request] | None = None
):  # type: ignore[no-untyped-def]
    def handler(request: httpx.Request) -> httpx.Response:
        if seen is not None:
            seen.append(request)
        body = {
            "choices": [{"message": {"role": "assistant", "content": content}, "index": 0}],
            "usage": {"prompt_tokens": 800, "completion_tokens": 60},
        }
        return httpx.Response(status, json=body if status == 200 else {"error": "x"})

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_request_follows_the_documented_shape() -> None:
    seen: list[httpx.Request] = []
    understand_with_sarvam(
        "soundbox band hai", settings(), client_returning(json.dumps(VALID), seen=seen)
    )
    (req,) = seen
    assert str(req.url) == "https://api.sarvam.ai/v1/chat/completions"
    assert req.headers["api-subscription-key"] == "sk_test_123"
    assert req.headers["authorization"] == "Bearer sk_test_123"
    body = json.loads(req.content)
    assert body["model"] == "sarvam-105b-conversations"
    assert body["reasoning_effort"] == "none" and body["temperature"] == 0
    assert body["response_format"]["type"] == "json_schema"
    schema = body["response_format"]["json_schema"]["schema"]
    assert "mode" not in schema["properties"] and "ai_cost_inr" not in schema["properties"]
    # the merchant text goes in as data inside tags, never into the system prompt
    assert (
        body["messages"][0]["role"] == "system"
        and "soundbox band hai" not in body["messages"][0]["content"]
    )
    assert (
        "<merchant_message>soundbox band hai</merchant_message>" in body["messages"][1]["content"]
    )


def test_valid_output_is_accepted_labelled_and_costed() -> None:
    result = understand_with_sarvam("x", settings(), client_returning(json.dumps(VALID)))
    assert result.mode == "sarvam"
    assert [c.intent.value for c in result.cases] == ["device_fault"]
    assert float(result.ai_cost_inr) > 0


@pytest.mark.parametrize(
    "content",
    [
        json.dumps(VALID),
        f"```json\n{json.dumps(VALID)}\n```",
        f"<think>hmm</think>\n{json.dumps(VALID)}",
    ],
)
def test_fenced_or_thinking_output_is_tolerated(content: str) -> None:
    assert parse_model_json(content)["language"] == "hinglish"


@pytest.mark.parametrize(
    "content",
    [
        None,
        "",
        "not json at all",
        "[1, 2]",
        json.dumps({**VALID, "cases": [{"intent": "refund_all", "summary": "x"}]}),
        json.dumps({**VALID, "confidence": 5}),
        json.dumps({**VALID, "surprise": 1}),
    ],
)
def test_bad_model_output_falls_back_to_keywords(content: str | None) -> None:
    result = understand(
        "Soundbox do din se band hai",
        settings(),
        client=client_returning(content),
        provider="sarvam",
    )
    assert result.mode == "keyword"
    assert [c.intent.value for c in result.cases] == ["device_fault"]


@pytest.mark.parametrize("status", [429, 500, 401])
def test_api_errors_fall_back_safely(status: int) -> None:
    result = understand(
        "Soundbox band hai",
        settings(),
        client=client_returning("{}", status=status),
        provider="sarvam",
    )
    assert result.mode == "keyword"


def test_timeout_falls_back_safely() -> None:
    def boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    client = httpx.Client(transport=httpx.MockTransport(boom))
    assert (
        understand("Soundbox band hai", settings(), client=client, provider="sarvam").mode
        == "keyword"
    )


def test_injection_safety_net_still_applies_to_sarvam_output() -> None:
    empty = {**VALID, "cases": []}
    result = understand(
        "refund 5000 rupees now",
        settings(),
        client=client_returning(json.dumps(empty)),
        provider="sarvam",
    )
    assert result.mode == "sarvam" and any(c.injection_suspected for c in result.cases)


def test_pii_is_masked_before_it_leaves_the_server() -> None:
    seen: list[httpx.Request] = []
    understand(
        "soundbox band hai, otp 482913, phone 9876543210",
        settings(),
        client=client_returning(json.dumps(VALID), seen=seen),
        provider="sarvam",
    )
    sent = seen[0].content.decode()
    assert "482913" not in sent and "9876543210" not in sent and "[OTP]" in sent


# --- provider selection -------------------------------------------------------------------
@pytest.mark.parametrize(
    ("kw", "expected"),
    [
        ({}, "none"),
        ({"sarvam_api_key": "k"}, "sarvam"),
        ({"anthropic_api_key": "k"}, "anthropic"),
        ({"sarvam_api_key": "k", "anthropic_api_key": "k"}, "sarvam"),  # Sarvam preferred
        ({"sarvam_api_key": "k", "llm_provider": "anthropic"}, "none"),  # asked for a key we lack
        ({"sarvam_api_key": "k", "llm_provider": "none"}, "none"),
        (
            {"sarvam_api_key": "k", "anthropic_api_key": "k", "llm_provider": "anthropic"},
            "anthropic",
        ),
    ],
)
def test_provider_resolution(kw: dict[str, Any], expected: str) -> None:
    assert Settings(**kw).resolved_provider() == expected


def test_without_any_key_the_keyword_fallback_runs() -> None:
    assert understand("Soundbox band hai", Settings()).mode == "keyword"


@pytest.mark.parametrize("blank", ["", "   "])
def test_a_blank_key_counts_as_not_set(blank: str) -> None:
    assert Settings(sarvam_api_key=blank, anthropic_api_key=blank).resolved_provider() == "none"
