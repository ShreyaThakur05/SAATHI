import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from alembic import command
from alembic.config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import health, merchant
from app.api.routes import router
from app.core.config import Settings, get_settings
from app.core.errors import register_error_handlers
from app.core.logging import configure_logging

log = logging.getLogger(__name__)


def assert_safe_for_production(settings: Settings) -> None:
    """Refuse to boot a production deployment that still uses development defaults."""
    if settings.env != "production":
        return
    problems = []
    if settings.jwt_secret.get_secret_value() == "dev-only-change-me-not-for-production-use":
        problems.append("SAATHI_JWT_SECRET is the development default")
    if settings.host_api_key.get_secret_value() == "dev-host-key":
        problems.append("SAATHI_HOST_API_KEY is the development default")
    if len(settings.jwt_secret.get_secret_value()) < 32:
        problems.append("SAATHI_JWT_SECRET must be at least 32 characters")
    if settings.demo_tools_enabled:
        problems.append("SAATHI_DEMO_TOOLS_ENABLED must be false")
    if problems:
        raise RuntimeError("Unsafe production configuration: " + "; ".join(problems))


def create_app() -> FastAPI:
    settings = get_settings()
    configure_logging(settings.log_level)
    assert_safe_for_production(settings)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        if settings.run_migrations_on_start:
            command.upgrade(Config("alembic.ini"), "head")
        if settings.demo_tools_enabled:
            from sqlalchemy.orm import Session

            from app.db.session import get_engine
            from app.seed.demo import seed_demo, seed_staff

            with Session(get_engine()) as session:
                seed_staff(session)
                if seed_demo(session):
                    log.info("demo data seeded")
        yield

    app = FastAPI(title="Paytm Saathi API", version="0.1.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["*"],
    )
    register_error_handlers(app)
    app.include_router(health.router)
    app.include_router(router)
    app.include_router(merchant.router)
    return app


app = create_app()
