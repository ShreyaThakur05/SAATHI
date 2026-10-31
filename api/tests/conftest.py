import os
from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db import models  # noqa: F401
from app.db.base import Base

# Tests must never read a developer's real api/.env (live model keys, production secrets). Environment
# variables take priority over the env file, so pin the sensitive ones before anything loads Settings.
for _name, _value in {
    "SAATHI_SARVAM_API_KEY": "",
    "SAATHI_ANTHROPIC_API_KEY": "",
    "SAATHI_LLM_PROVIDER": "auto",
    "SAATHI_JWT_SECRET": "dev-only-change-me-not-for-production-use",
    "SAATHI_HOST_API_KEY": "dev-host-key",
    "SAATHI_DEMO_TOOLS_ENABLED": "false",
    "SAATHI_ENV": "local",
}.items():
    os.environ[_name] = _value

pytest_plugins = ["tests.api_fixtures"]

TEST_DB = "saathi_test"


@pytest.fixture(scope="session")
def engine():  # type: ignore[no-untyped-def]
    """A throwaway Postgres database, never the dev one."""
    url = make_url(get_settings().database_url)
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)"))
        conn.execute(text(f"CREATE DATABASE {TEST_DB}"))
    eng = create_engine(url.set(database=TEST_DB))
    yield eng
    eng.dispose()
    with admin.connect() as conn:
        conn.execute(text(f"DROP DATABASE IF EXISTS {TEST_DB} WITH (FORCE)"))
    admin.dispose()


@pytest.fixture
def session(engine) -> Iterator[Session]:  # type: ignore[no-untyped-def]
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    with sessionmaker(engine, expire_on_commit=False)() as s:
        yield s
