from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    return create_engine(
        settings.database_url,
        pool_pre_ping=True,
        # A leaked idle transaction must not be able to hold locks (and block admin work) forever.
        connect_args={
            "options": f"-c idle_in_transaction_session_timeout={settings.db_idle_in_tx_timeout_ms}"
        },
    )


def get_session() -> Iterator[Session]:
    factory = sessionmaker(get_engine(), expire_on_commit=False)
    with factory() as session:
        yield session
