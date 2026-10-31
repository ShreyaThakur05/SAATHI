from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """All configuration comes from environment variables (12-factor)."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="SAATHI_", extra="ignore")

    env: str = "local"
    log_level: str = "INFO"
    database_url: str = Field(
        default="postgresql+psycopg://saathi:saathi@localhost:5433/saathi",
        description="SQLAlchemy URL using the psycopg v3 driver",
    )
    db_idle_in_tx_timeout_ms: int = 15000
    cors_origins: list[str] = ["http://localhost:3000"]
    run_migrations_on_start: bool = False

    # Auth. No defaults for secrets in production: validated in create_app().
    jwt_secret: SecretStr = SecretStr("dev-only-change-me-not-for-production-use")
    host_api_key: SecretStr = SecretStr("dev-host-key")  # Paytm host app -> embed tokens
    token_ttl_minutes: int = 60
    # Seeds demo accounts/data and enables /v1/demo/*. Off by default; refused in production.
    demo_tools_enabled: bool = False

    # AI. Without any key, Understand uses the deterministic keyword fallback.
    # llm_provider "auto" picks Sarvam if its key is set, else Anthropic, else none.
    llm_provider: Literal["auto", "sarvam", "anthropic", "none"] = "auto"
    sarvam_api_key: SecretStr | None = None
    sarvam_base_url: str = "https://api.sarvam.ai"
    sarvam_model: str = "sarvam-105b-conversations"  # 32K context, built for low-latency chat
    sarvam_reasoning_effort: Literal["none", "low", "medium", "high", "max"] = "none"
    anthropic_api_key: SecretStr | None = None
    understand_model: str = "claude-haiku-5-5"
    llm_timeout_s: float = 8.0
    llm_input_usd_per_mtok: float = 0.0  # set to your contracted rates to measure Rs cost
    llm_output_usd_per_mtok: float = 0.0
    usd_inr: float = 84.0

    # Simulation
    sim_latency_ms: int = 350
    sim_refund_polls: int = 2

    @field_validator("sarvam_api_key", "anthropic_api_key", mode="before")
    @classmethod
    def _blank_key_is_unset(cls, v: object) -> object:
        # `SAATHI_SARVAM_API_KEY=` in an env file must mean "not set", not "set to empty".
        return None if isinstance(v, str) and not v.strip() else v

    def resolved_provider(self) -> Literal["sarvam", "anthropic", "none"]:
        """Which LLM actually runs, given the explicit choice and the keys that are present."""
        if self.llm_provider == "sarvam":
            return "sarvam" if self.sarvam_api_key else "none"
        if self.llm_provider == "anthropic":
            return "anthropic" if self.anthropic_api_key else "none"
        if self.llm_provider == "none":
            return "none"
        if self.sarvam_api_key:
            return "sarvam"
        return "anthropic" if self.anthropic_api_key else "none"

    @property
    def llm_model(self) -> str | None:
        return {"sarvam": self.sarvam_model, "anthropic": self.understand_model}.get(
            self.resolved_provider()
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
