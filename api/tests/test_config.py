import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

import app.main as main
from app.core.config import Settings

GOOD = {"jwt_secret": "x" * 40, "host_api_key": "y" * 40}


@pytest.mark.parametrize(
    ("given", "expected"),
    [
        ("postgres://u:p@host:5432/db", "postgresql+psycopg://u:p@host:5432/db"),
        (
            "postgresql://u:p@host/db?sslmode=require",
            "postgresql+psycopg://u:p@host/db?sslmode=require",
        ),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),  # already right
    ],
)
def test_hosted_database_urls_are_accepted_as_given(given: str, expected: str) -> None:
    assert Settings(database_url=given).database_url == expected


def test_a_bad_cors_regex_fails_at_startup_and_blank_means_none() -> None:
    with pytest.raises(ValidationError):
        Settings(cors_origin_regex="([unclosed")
    assert Settings(cors_origin_regex="  ").cors_origin_regex is None


def _preflight(origin: str, settings: Settings) -> str | None:
    main.get_settings = lambda: settings  # type: ignore[assignment]
    try:
        with TestClient(main.create_app()) as c:
            res = c.options(
                "/v1/messages",
                headers={"Origin": origin, "Access-Control-Request-Method": "POST"},
            )
            return res.headers.get("access-control-allow-origin")
    finally:
        main.get_settings = __import__("app.core.config", fromlist=["get_settings"]).get_settings


def test_cors_allows_listed_origins_and_matching_preview_urls_only() -> None:
    s = Settings(
        cors_origins=["https://saathi.vercel.app"],
        cors_origin_regex=r"https://saathi-[a-z0-9-]+\.vercel\.app",
    )
    assert _preflight("https://saathi.vercel.app", s) == "https://saathi.vercel.app"
    assert (
        _preflight("https://saathi-git-fix-me.vercel.app", s)
        == "https://saathi-git-fix-me.vercel.app"
    )
    assert _preflight("https://evil.example", s) is None
    assert _preflight("https://saathi.vercel.app.evil.example", s) is None


def test_sandbox_must_use_real_secrets_but_may_keep_demo_tools() -> None:
    with pytest.raises(RuntimeError, match="development default"):
        main.assert_safe_for_production(Settings(env="sandbox"))
    main.assert_safe_for_production(Settings(env="sandbox", demo_tools_enabled=True, **GOOD))  # type: ignore[arg-type]


def test_production_still_refuses_demo_tools() -> None:
    with pytest.raises(RuntimeError, match="DEMO_TOOLS"):
        main.assert_safe_for_production(Settings(env="production", demo_tools_enabled=True, **GOOD))  # type: ignore[arg-type]
    main.assert_safe_for_production(Settings(env="production", **GOOD))  # type: ignore[arg-type]
