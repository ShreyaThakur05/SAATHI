from typing import Annotated

from fastapi import APIRouter, Depends, Response
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.session import get_session

router = APIRouter(tags=["health"])


@router.get("/healthz")
def healthz() -> dict[str, str]:
    """Liveness: the process is up. No dependencies checked."""
    return {"status": "ok"}


@router.get("/readyz")
def readyz(response: Response, session: Annotated[Session, Depends(get_session)]) -> dict[str, str]:
    """Readiness: dependencies (database) are reachable."""
    try:
        session.execute(text("SELECT 1"))
    except SQLAlchemyError:
        response.status_code = 503
        return {"status": "unavailable", "database": "down"}
    return {"status": "ready", "database": "up"}
