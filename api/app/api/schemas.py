from datetime import datetime
from decimal import Decimal
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class LoginIn(BaseModel):
    email: str = Field(max_length=160)
    password: str = Field(max_length=200)


class UserOut(ORM):
    id: int
    email: str
    name: str
    role: str


class LoginOut(BaseModel):
    token: str
    user: UserOut


class EmbedTokenIn(BaseModel):
    merchant_id: int
    language: Literal["hi", "hinglish", "en"] = "hi"


class TokenOut(BaseModel):
    token: str
    expires_in_s: int


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=1000)
    input_mode: Literal["text", "voice"] = "text"
    conversation_id: int | None = None


class MessageOut(ORM):
    id: int
    conversation_id: int
    role: str
    text: str
    input_mode: str
    card: dict[str, Any] | None
    case_id: int | None
    created_at: datetime


class MessageAccepted(BaseModel):
    conversation_id: int
    message_id: int
    case_ids: list[int]


class DocumentIn(BaseModel):
    doc_type: Literal["PAN", "GST", "BANK_PROOF", "SHOP_PHOTO"]


class CaseSummary(ORM):
    id: int
    merchant_id: int
    merchant_name: str | None = None
    product: str
    intent: str
    status: str
    summary: str
    language: str
    handled_by_person: bool
    injection_suspected: bool
    understanding_mode: str
    ai_cost_inr: Decimal
    refund_deadline_at: datetime | None
    created_at: datetime
    resolved_at: datetime | None


class StepOut(ORM):
    seq: int
    kind: str
    status: str
    title: str
    detail: dict[str, Any]
    created_at: datetime


class ActionOut(ORM):
    id: int
    name: str
    idempotency_key: str
    amount_inr: Decimal | None
    status: str
    reference: str | None
    proved: bool | None
    approved_by_user_id: int | None
    created_at: datetime


class ApprovalOut(ORM):
    id: int
    case_id: int
    action: str
    amount_inr: Decimal | None
    rule_id: str
    reason: str
    evidence: dict[str, Any]
    status: str
    requested_at: datetime
    decided_at: datetime | None
    decision_note: str | None
    decided_by: str | None = None
    case_summary: str | None = None
    merchant_name: str | None = None


class CaseDetail(BaseModel):
    case: CaseSummary
    steps: list[StepOut]
    actions: list[ActionOut]
    approvals: list[ApprovalOut]
    messages: list[MessageOut]


class Page[T](BaseModel):
    items: list[T]
    total: int
    limit: int
    offset: int


class DecisionIn(BaseModel):
    approve: bool
    note: str | None = Field(default=None, max_length=240)


class AuditOut(ORM):
    id: int
    ts: datetime
    actor: str
    event: str
    case_id: int | None
    data: dict[str, Any]


class SkillPackOut(BaseModel):
    skill_pack: str
    title: str
    status: str
    version: int
    product: str
    intents: list[str]
    allowed_actions: list[str]
    action_limits_inr: dict[str, Decimal]
    requires_person: list[str]
    hand_off_if: list[str]
    proof: dict[str, str]
    max_prior_claims: int
    source_yaml: str
