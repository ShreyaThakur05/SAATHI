"""Shared API fixtures, registered as a pytest plugin from conftest."""

from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session, sessionmaker

from app.api import deps
from app.api.deps import get_runtime
from app.core.config import Settings, get_settings
from app.db.session import get_session
from app.main import create_app
from app.seed.demo import seed_demo, seed_staff
from app.services.connectors import build_simulated_connectors
from app.services.runtime import Runtime
from app.skillpacks.loader import get_registry


@pytest.fixture
def ids(session: Session) -> dict[str, int]:
    seed_staff(session)
    return seed_demo(session)


@pytest.fixture
def client(engine, session, ids) -> Iterator[TestClient]:  # type: ignore[no-untyped-def]
    factory = sessionmaker(engine, expire_on_commit=False)
    settings = Settings(anthropic_api_key=None, sim_latency_ms=0, demo_tools_enabled=True)
    rt = Runtime(
        settings=settings,
        session_factory=factory,
        make_connectors=lambda s: build_simulated_connectors(s, 0, 2),
        registry=get_registry(),
    )
    app = create_app()

    def _session() -> Iterator[Session]:
        with factory() as s:
            yield s

    app.dependency_overrides[get_session] = _session
    app.dependency_overrides[get_runtime] = lambda: rt
    app.dependency_overrides[get_settings] = lambda: settings
    deps.message_limiter._hits.clear()
    deps.login_limiter._hits.clear()
    deps.login_ip_limiter._hits.clear()
    with TestClient(app) as c:
        yield c
