from functools import lru_cache

from pydantic import Field, SecretStr
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

    # AI. Without a key, Understand uses the deterministic keyword fallback.
    anthropic_api_key: SecretStr | None = None
    understand_model: str = "claude-haiku-5-5"
    llm_timeout_s: float = 8.0
    llm_input_usd_per_mtok: float = 0.0  # set to your contracted rates to measure Rs cost
    llm_output_usd_per_mtok: float = 0.0
    usd_inr: float = 84.0

    # Simulation
    sim_latency_ms: int = 350
    sim_refund_polls: int = 2


@lru_cache
def get_settings() -> Settings:
    return Settings()
