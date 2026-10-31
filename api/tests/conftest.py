from collections.abc import Iterator

import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings
from app.db import models  # noqa: F401
from app.db.base import Base

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
