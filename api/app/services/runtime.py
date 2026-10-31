from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy.orm import Session, sessionmaker

from app.core.config import Settings, get_settings
from app.db.session import get_engine
from app.services.connectors import Connectors, build_simulated_connectors
from app.skillpacks.loader import SkillPackRegistry, get_registry


@dataclass(frozen=True)
class Runtime:
    """Everything the orchestrator needs, injectable so tests can swap it."""

    settings: Settings
    session_factory: Callable[[], Session]
    make_connectors: Callable[[Session], Connectors]
    registry: SkillPackRegistry


def default_runtime() -> Runtime:
    settings = get_settings()
    factory = sessionmaker(get_engine(), expire_on_commit=False)
    return Runtime(
        settings=settings,
        session_factory=factory,
        make_connectors=lambda s: build_simulated_connectors(
            s, settings.sim_latency_ms, settings.sim_refund_polls
        ),
        registry=get_registry(),
    )
