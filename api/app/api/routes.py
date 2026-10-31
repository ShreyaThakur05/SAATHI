import json
import time
from collections.abc import Callable, Iterator
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api import schemas as sc
from app.api.deps import (
    AdminDep,
    ApproverDep,
    HostDep,
    MerchantDep,
    RuntimeDep,
    SessionDep,
    SettingsDep,
    StaffDep,
    login_ip_limiter,
    login_limiter,
    message_limiter,
)
from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import issue_token, verify_password
from app.db.models import (
    ActionRecord,
    Approval,
    AuditLog,
    Case,
    CaseStep,
    Conversation,
    Merchant,
    Message,
    User,
)
from app.domain.types import TERMINAL_STATUSES, CaseStatus
from app.services.intake import intake_message
from app.services.metrics import compute_metrics
from app.services.orchestrator import decide_approval, receive_document, run_cases
from app.skillpacks.loader import pack_sources

router = APIRouter(prefix="/v1")


# ------------------------------------------------------------------------------ auth
@router.post("/auth/login", response_model=sc.LoginOut, tags=["auth"])
def login(body: sc.LoginIn, request: Request, session: SessionDep, settings: SettingsDep):  # type: ignore[no-untyped-def]
    ip = request.client.host if request.client else "unknown"
    login_ip_limiter.check(ip)
    login_limiter.check(f"{ip}:{body.email.lower()}")
    user = session.scalars(select(User).where(User.email == body.email.lower())).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise AppError("invalid_credentials", "Wrong email or password", 401)
    token = issue_token(settings, {"sub": str(user.id), "scope": "staff", "role": user.role})
    return sc.LoginOut(token=token, user=sc.UserOut.model_validate(user))


@router.get("/me", response_model=sc.UserOut, tags=["auth"])
def me(user: StaffDep) -> User:
    return user


@router.post("/embed/token", response_model=sc.TokenOut, tags=["embed"], dependencies=[HostDep])
def embed_token(body: sc.EmbedTokenIn, session: SessionDep, settings: SettingsDep) -> sc.TokenOut:
    """Server-to-server: the host (Paytm dashboard backend) vouches for a signed-in merchant."""
    if session.get(Merchant, body.merchant_id) is None:
        raise AppError("unknown_merchant", "Merchant not found", 404)
    ttl = 30
    token = issue_token(
        settings,
        {
            "sub": f"merchant:{body.merchant_id}",
            "scope": "merchant",
            "merchant_id": body.merchant_id,
            "lang": body.language,
        },
        ttl_minutes=ttl,
    )
    return sc.TokenOut(token=token, expires_in_s=ttl * 60)


# ------------------------------------------------------------------------ merchant side
@router.post("/messages", response_model=sc.MessageAccepted, status_code=202, tags=["merchant"])
def post_message(
    body: sc.MessageIn,
    background: BackgroundTasks,
    session: SessionDep,
    rt: RuntimeDep,
    merchant: MerchantDep,
) -> sc.MessageAccepted:
    message_limiter.check(f"merchant:{merchant.merchant_id}")
    result = intake_message(
        session,
        rt.registry,
        rt.settings,
        merchant.merchant_id,
        body.text,
        body.input_mode,
        body.conversation_id,
    )
    if result.case_ids:
        background.add_task(run_cases, rt, result.case_ids)
    return sc.MessageAccepted(
        conversation_id=result.conversation_id,
        message_id=result.message_id,
        case_ids=result.case_ids,
    )


@router.get("/conversations/latest/messages", response_model=list[sc.MessageOut], tags=["merchant"])
def latest_conversation(
    session: SessionDep, merchant: MerchantDep, after: int = 0
) -> list[Message]:
    convo = session.scalars(
        select(Conversation)
        .where(Conversation.merchant_id == merchant.merchant_id)
        .order_by(Conversation.id.desc())
    ).first()
    return [] if convo is None else _messages(session, convo.id, after)


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=list[sc.MessageOut],
    tags=["merchant"],
)
def conversation_messages(
    conversation_id: int, session: SessionDep, merchant: MerchantDep, after: int = 0
) -> list[Message]:
    convo = session.get(Conversation, conversation_id)
    if convo is None or convo.merchant_id != merchant.merchant_id:
        raise AppError("unknown_conversation", "Conversation not found", 404)
    return _messages(session, conversation_id, after)


def _messages(session: Session, conversation_id: int, after: int) -> list[Message]:
    return list(
        session.scalars(
            select(Message)
            .where(Message.conversation_id == conversation_id, Message.id > after)
            .order_by(Message.id)
            .limit(200)
        )
    )


@router.post("/cases/{case_id}/documents", response_model=sc.CaseSummary, tags=["merchant"])
def submit_document(
    case_id: int, body: sc.DocumentIn, session: SessionDep, rt: RuntimeDep, merchant: MerchantDep
) -> sc.CaseSummary:
    case = receive_document(rt, session, case_id, merchant.merchant_id, body.doc_type)
    return _summary(session, case)


# --------------------------------------------------------------------------- team console
def _summary(session: Session, case: Case) -> sc.CaseSummary:
    out = sc.CaseSummary.model_validate(case)
    merchant = session.get(Merchant, case.merchant_id)
    out.merchant_name = merchant.name if merchant else None
    return out


@router.get("/cases", response_model=sc.Page[sc.CaseSummary], tags=["console"])
def list_cases(
    session: SessionDep,
    _: StaffDep,
    status: Annotated[str | None, Query(pattern="^[A-Z_]+$")] = None,
    product: Annotated[str | None, Query(pattern="^[A-Z_]+$")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> sc.Page[sc.CaseSummary]:
    q = select(Case)
    if status:
        q = q.where(Case.status == status)
    if product:
        q = q.where(Case.product == product)
    total = session.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = session.scalars(q.order_by(Case.id.desc()).limit(limit).offset(offset))
    return sc.Page(
        items=[_summary(session, c) for c in rows], total=total, limit=limit, offset=offset
    )


def _approval_out(session: Session, a: Approval) -> sc.ApprovalOut:
    out = sc.ApprovalOut.model_validate(a)
    case = session.get(Case, a.case_id)
    if case:
        out.case_summary = case.summary
        merchant = session.get(Merchant, case.merchant_id)
        out.merchant_name = merchant.name if merchant else None
    if a.decided_by_user_id:
        user = session.get(User, a.decided_by_user_id)
        out.decided_by = user.name if user else None
    return out


@router.get("/cases/{case_id}", response_model=sc.CaseDetail, tags=["console"])
def case_detail(case_id: int, session: SessionDep, _: StaffDep) -> sc.CaseDetail:
    case = session.get(Case, case_id)
    if case is None:
        raise AppError("unknown_case", "Case not found", 404)
    steps = session.scalars(
        select(CaseStep).where(CaseStep.case_id == case_id).order_by(CaseStep.seq)
    )
    actions = session.scalars(
        select(ActionRecord).where(ActionRecord.case_id == case_id).order_by(ActionRecord.id)
    )
    approvals = session.scalars(
        select(Approval).where(Approval.case_id == case_id).order_by(Approval.id)
    )
    messages = session.scalars(
        select(Message).where(Message.conversation_id == case.conversation_id).order_by(Message.id)
    )
    return sc.CaseDetail(
        case=_summary(session, case),
        steps=[sc.StepOut.model_validate(s) for s in steps],
        actions=[sc.ActionOut.model_validate(a) for a in actions],
        approvals=[_approval_out(session, a) for a in approvals],
        messages=[sc.MessageOut.model_validate(m) for m in messages],
    )


@router.get("/cases/{case_id}/stream", tags=["console"])
def case_stream(case_id: int, rt: RuntimeDep, user: StaffDep) -> StreamingResponse:
    """Server-Sent Events: each new step as it is written, then a `done` marker."""
    return StreamingResponse(
        _stream_case(rt.session_factory, case_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


def _stream_case(
    session_factory: Callable[[], Session],
    case_id: int,
    poll_s: float = 0.4,
    max_idle_s: float = 90.0,
) -> Iterator[str]:
    last_seq, idle_since, quiet_polls = 0, time.monotonic(), 0
    while True:
        # Read inside the session, then release it BEFORE yielding: a generator suspended at a
        # yield (client slow or gone) must never hold an open database transaction.
        with session_factory() as session:
            case = session.get(Case, case_id)
            status = case.status if case else None
            steps = (
                list(
                    session.scalars(
                        select(CaseStep)
                        .where(CaseStep.case_id == case_id, CaseStep.seq > last_seq)
                        .order_by(CaseStep.seq)
                    )
                )
                if case
                else []
            )
        if status is None:
            yield _sse("error", {"code": "unknown_case"})
            return
        for step in steps:
            last_seq = step.seq
            yield _sse("step", sc.StepOut.model_validate(step).model_dump(mode="json"))
        quiet_polls = 0 if steps else quiet_polls + 1
        if steps:
            idle_since = time.monotonic()
        settled = CaseStatus(status) in TERMINAL_STATUSES or status in {
            CaseStatus.AWAITING_APPROVAL.value,
            CaseStatus.WAITING_MERCHANT.value,
        }
        if settled and quiet_polls >= 2:
            yield _sse("done", {"status": status})
            return
        if time.monotonic() - idle_since > max_idle_s:
            yield _sse("done", {"status": status, "idle": True})
            return
        time.sleep(poll_s)


def _sse(event: str, data: dict[str, object]) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.get("/approvals", response_model=sc.Page[sc.ApprovalOut], tags=["console"])
def list_approvals(
    session: SessionDep,
    _: StaffDep,
    status: Annotated[str, Query(pattern="^(PENDING|APPROVED|REJECTED)$")] = "PENDING",
    limit: Annotated[int, Query(ge=1, le=100)] = 25,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> sc.Page[sc.ApprovalOut]:
    q = select(Approval).where(Approval.status == status)
    total = session.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = session.scalars(q.order_by(Approval.id.desc()).limit(limit).offset(offset))
    return sc.Page(
        items=[_approval_out(session, a) for a in rows], total=total, limit=limit, offset=offset
    )


@router.post("/approvals/{approval_id}/decision", response_model=sc.CaseSummary, tags=["console"])
def decide(
    approval_id: int, body: sc.DecisionIn, session: SessionDep, rt: RuntimeDep, user: ApproverDep
) -> sc.CaseSummary:
    if session.get(Approval, approval_id) is None:
        raise AppError("unknown_approval", "Approval not found", 404)
    case = decide_approval(rt, session, approval_id, user, body.approve, body.note)
    return _summary(session, case)


@router.get("/audit", response_model=sc.Page[sc.AuditOut], tags=["console"])
def audit(
    session: SessionDep,
    _: StaffDep,
    case_id: int | None = None,
    event: Annotated[str | None, Query(max_length=48)] = None,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> sc.Page[sc.AuditOut]:
    q = select(AuditLog)
    if case_id is not None:
        q = q.where(AuditLog.case_id == case_id)
    if event:
        q = q.where(AuditLog.event.like(f"{event}%"))
    total = session.scalar(select(func.count()).select_from(q.subquery())) or 0
    rows = session.scalars(q.order_by(AuditLog.id.desc()).limit(limit).offset(offset))
    return sc.Page(
        items=[sc.AuditOut.model_validate(r) for r in rows], total=total, limit=limit, offset=offset
    )


@router.get("/metrics", tags=["console"])
def metrics(session: SessionDep, settings: SettingsDep, _: StaffDep) -> dict[str, object]:
    return compute_metrics(session, settings)


@router.get("/skill-packs", response_model=list[sc.SkillPackOut], tags=["console"])
def skill_packs(rt: RuntimeDep, _: StaffDep) -> list[sc.SkillPackOut]:
    sources = pack_sources()
    return [
        sc.SkillPackOut(
            skill_pack=pack.skill_pack,
            title=pack.title,
            status=pack.status.value,
            version=pack.version,
            product=pack.product.value,
            intents=[i.value for i in pack.intents],
            allowed_actions=pack.allowed_actions,
            action_limits_inr=pack.action_limits_inr,
            requires_person=pack.requires_person,
            hand_off_if=[h.value for h in pack.hand_off_if],
            proof=pack.proof,
            max_prior_claims=pack.max_prior_claims,
            source_yaml=sources[pack.skill_pack],
        )
        for pack in rt.registry.all()
    ]


@router.get("/system/status", tags=["console"])
def system_status(settings: SettingsDep, _: StaffDep) -> dict[str, object]:
    """What this environment is connected to, stated plainly (console Settings page)."""
    llm = settings.anthropic_api_key is not None
    sim = "Simulated: same shape as the real system, backed by this database"
    return {
        "env": settings.env,
        "version": "0.1.0",
        "understanding": {
            "mode": "claude" if llm else "keyword",
            "model": settings.understand_model if llm else None,
        },
        "integrations": [
            {"name": "Device status and remote fixes", "kind": "simulated", "detail": sim},
            {"name": "Rental billing and reversals", "kind": "simulated", "detail": sim},
            {"name": "Logistics and replacement orders", "kind": "simulated", "detail": sim},
            {"name": "Settlement ledger and KYC", "kind": "simulated", "detail": sim},
            {"name": "Biller network", "kind": "simulated", "detail": sim},
            {
                "name": "Payment gateway (Refund and Refund Status APIs)",
                "kind": "simulated",
                "detail": "Simulated: mirrors the API shape; no real money moves",
            },
            {
                "name": "Web chat and voice notes",
                "kind": "live",
                "detail": "Browser speech recognition",
            },
            {"name": "WhatsApp", "kind": "not_configured", "detail": "Not built in this version"},
            {
                "name": "Server-side Indian-language speech-to-text",
                "kind": "not_configured",
                "detail": "Not built; browser speech recognition is used",
            },
        ],
        "demo_tools_enabled": settings.demo_tools_enabled,
        "sim_latency_ms": settings.sim_latency_ms,
    }


# ------------------------------------------------------------------------------ demo
@router.get("/demo/merchants", tags=["demo"], dependencies=[HostDep])
def demo_merchants(session: SessionDep, settings: SettingsDep) -> list[dict[str, object]]:
    _require_demo(settings)
    return [
        {"id": m.id, "name": m.name, "language": m.language}
        for m in session.scalars(select(Merchant).order_by(Merchant.id))
    ]


@router.post("/demo/reset", tags=["demo"])
def demo_reset(session: SessionDep, settings: SettingsDep, _: AdminDep) -> dict[str, object]:
    """Wipe all data and reseed the four pitch scenarios (so a demo is repeatable)."""
    _require_demo(settings)
    from sqlalchemy.exc import OperationalError

    from app.seed.demo import reset_demo

    try:
        return {"seeded": reset_demo(session)}
    except OperationalError as exc:  # lock timeout: something else is using the tables
        session.rollback()
        raise AppError("reset_busy", "Demo data is busy; try again in a few seconds", 409) from exc


def _require_demo(settings: Settings) -> None:
    if not settings.demo_tools_enabled:
        raise AppError("demo_disabled", "Demo tools are disabled", 404)
