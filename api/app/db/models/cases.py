from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import (
    DDL,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    event,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.db.models.systems import Money

JSON = JSONB


class User(Base):
    """Paytm support staff using the team console."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(160), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(24))  # AGENT | RISK_APPROVER | ADMIN
    password_hash: Mapped[str] = mapped_column(String(256))


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    channel: Mapped[str] = mapped_column(String(16), default="WEB_CHAT")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), index=True)
    role: Mapped[str] = mapped_column(String(12))  # MERCHANT | SAATHI
    text: Mapped[str] = mapped_column(Text)  # PII-masked before storage
    input_mode: Mapped[str] = mapped_column(String(8), default="text")  # text | voice
    card: Mapped[dict[str, Any] | None] = mapped_column(JSON)  # structured status card
    # How to re-render this message in any language: {"kind": "ack"|"replies", ...}. The stored
    # `text` is the rendering at post time; clients ask for another language via ?lang=.
    render: Mapped[dict[str, Any] | None] = mapped_column(JSON)
    case_id: Mapped[int | None] = mapped_column(ForeignKey("cases.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Case(Base):
    __tablename__ = "cases"
    __table_args__ = (Index("ix_cases_merchant_intent", "merchant_id", "intent"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id"), index=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"))
    product: Mapped[str] = mapped_column(String(24))
    intent: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(24), index=True, default="OPEN")
    language: Mapped[str] = mapped_column(String(8))
    summary: Mapped[str] = mapped_column(Text)
    claimed_amount_inr: Mapped[Decimal | None] = mapped_column(Money)
    injection_suspected: Mapped[bool] = mapped_column(default=False)
    legal_mention: Mapped[bool] = mapped_column(default=False)
    waiting_for: Mapped[str | None] = mapped_column(String(24))  # e.g. GST
    handled_by_person: Mapped[bool] = mapped_column(default=False)
    refund_deadline_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ai_cost_inr: Mapped[Decimal] = mapped_column(Money, default=Decimal("0"))
    understanding_mode: Mapped[str] = mapped_column(String(16), default="keyword")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class CaseStep(Base):
    __tablename__ = "case_steps"
    __table_args__ = (UniqueConstraint("case_id", "seq"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    seq: Mapped[int]
    kind: Mapped[str] = mapped_column(String(12))
    status: Mapped[str] = mapped_column(String(8))
    title: Mapped[str] = mapped_column(String(200))
    detail: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ActionRecord(Base):
    """One row per action. The unique key is why an action can never run twice."""

    __tablename__ = "actions"
    __table_args__ = (UniqueConstraint("idempotency_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    name: Mapped[str] = mapped_column(String(32))
    idempotency_key: Mapped[str] = mapped_column(String(64))
    amount_inr: Mapped[Decimal | None] = mapped_column(Money)
    status: Mapped[str] = mapped_column(String(12), default="PENDING")  # PENDING|DONE|FAILED
    reference: Mapped[str | None] = mapped_column(String(48))
    proved: Mapped[bool | None]
    approved_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Approval(Base):
    __tablename__ = "approvals"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("cases.id"), index=True)
    action: Mapped[str] = mapped_column(String(32))  # or "manual_review"
    amount_inr: Mapped[Decimal | None] = mapped_column(Money)
    params: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    rule_id: Mapped[str] = mapped_column(String(32))
    reason: Mapped[str] = mapped_column(String(240))
    evidence: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    status: Mapped[str] = mapped_column(String(10), default="PENDING", index=True)
    requested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    decision_note: Mapped[str | None] = mapped_column(String(240))


class AuditLog(Base):
    """Append-only. A database trigger rejects UPDATE and DELETE."""

    __tablename__ = "audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    ts: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    actor: Mapped[str] = mapped_column(String(64))
    event: Mapped[str] = mapped_column(String(48), index=True)
    case_id: Mapped[int | None] = mapped_column(ForeignKey("cases.id"), index=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


AUDIT_IMMUTABLE_SQL = [
    """CREATE OR REPLACE FUNCTION audit_log_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_log is append-only'; END; $$ LANGUAGE plpgsql""",
    """CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION audit_log_immutable()""",
]
for _stmt in AUDIT_IMMUTABLE_SQL:
    event.listen(
        AuditLog.__table__,
        "after_create",
        DDL(_stmt).execute_if(dialect="postgresql"),  # type: ignore[no-untyped-call]
    )
