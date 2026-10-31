"""Writes the case timeline and the append-only audit log, and guards status changes."""

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.models import AuditLog, Case, CaseStep
from app.domain.types import (
    ALLOWED_TRANSITIONS,
    TERMINAL_STATUSES,
    CaseStatus,
    StepKind,
    StepStatus,
)

SYSTEM_ACTOR = "system:saathi"


class CaseRecorder:
    def __init__(self, session: Session, case: Case) -> None:
        self._s = session
        self.case = case

    def audit(self, event: str, /, *, actor: str = SYSTEM_ACTOR, **data: Any) -> None:
        self._s.add(AuditLog(actor=actor, event=event, case_id=self.case.id, data=to_json(data)))

    def step(self, kind: StepKind, status: StepStatus, title: str, /, **detail: Any) -> None:
        seq = (
            self._s.scalar(
                select(func.coalesce(func.max(CaseStep.seq), 0)).where(
                    CaseStep.case_id == self.case.id
                )
            )
            or 0
        ) + 1
        self._s.add(
            CaseStep(
                case_id=self.case.id,
                seq=seq,
                kind=kind.value,
                status=status.value,
                title=title,
                detail=to_json(detail),
            )
        )
        self.audit(
            f"step.{kind.value.lower()}",
            step_status=status.value,
            title=title,
            **detail,
        )
        self._s.commit()

    def transition(self, new: CaseStatus, actor: str = SYSTEM_ACTOR) -> None:
        current = CaseStatus(self.case.status)
        if new not in ALLOWED_TRANSITIONS[current]:
            raise AppError("invalid_transition", f"{current} -> {new} not allowed", 409)
        self.case.status = new.value
        if new in TERMINAL_STATUSES:
            self.case.resolved_at = datetime.now(UTC)
        self.audit("case.status", actor=actor, status=new.value, previous=current.value)
        self._s.commit()


def to_json(data: dict[str, Any]) -> dict[str, Any]:
    """Make values JSON-safe (Decimal, datetime, enums) without losing precision."""
    out: dict[str, Any] = {}
    for key, value in data.items():
        if isinstance(value, dict):
            out[key] = to_json(value)
        elif isinstance(value, list | tuple):
            out[key] = [to_json({"v": v})["v"] for v in value]
        elif isinstance(value, bool | int | float | str) or value is None:
            out[key] = value
        else:
            out[key] = str(value)
    return out
