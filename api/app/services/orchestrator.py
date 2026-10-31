"""Runs cases through Listen/Understand/Look up/Decide/Act/Prove and handles follow-ups."""

import logging
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.connectors.base import ConnectorError
from app.core.errors import AppError
from app.db.models import Approval, Case, User
from app.domain.types import CaseStatus, Intent, StepKind, StepStatus
from app.rules.engine import CaseFacts, Outcome
from app.services.actions import run_action, success_reply
from app.services.context import Ctx, is_roadmap_intent
from app.services.messaging import card_for, compose, post_saathi, replies_render
from app.services.playbooks import PLAYBOOKS, prepare_release
from app.services.recorder import CaseRecorder
from app.services.replies import Reply, render
from app.services.runtime import Runtime
from app.skillpacks.models import SkillPack

log = logging.getLogger(__name__)


def _pack_for(rt: Runtime, case: Case) -> SkillPack:
    pack = rt.registry.for_intent(Intent(case.intent)) or rt.registry.get("bill_payments")
    assert pack is not None
    return pack


def _ctx(rt: Runtime, session: Session, case: Case) -> Ctx:
    return Ctx(
        session, case, _pack_for(rt, case), rt.make_connectors(session), CaseRecorder(session, case)
    )


def _claim_open(session: Session, case_id: int) -> bool:
    """Atomically move OPEN -> IN_PROGRESS so a case can only be worked once."""
    row = session.execute(
        update(Case)
        .where(Case.id == case_id, Case.status == CaseStatus.OPEN.value)
        .values(status=CaseStatus.IN_PROGRESS.value)
        .returning(Case.id)
    ).first()
    session.commit()
    return row is not None


def _run_playbook(ctx: Ctx) -> Reply:
    case = ctx.case
    if case.injection_suspected:
        facts = CaseFacts(injection_suspected=True)
        decision = ctx.decide("refund_bill", facts, amount=case.claimed_amount_inr)
        assert decision.outcome is Outcome.BLOCK
        ctx.rec.audit("instruction_blocked", claimed_amount=case.claimed_amount_inr)
        return ctx.finish(CaseStatus.BLOCKED, Reply("blocked_instruction"))
    if is_roadmap_intent(case.intent):
        return ctx.manual_review(
            "unsupported_product",
            f"{case.product.title()} is on the roadmap; no Skill Pack is live",
            {"intent": case.intent},
            reply_key="unsupported",
        )
    return PLAYBOOKS[case.intent](ctx)


def process_case(rt: Runtime, session: Session, case_id: int) -> tuple[Case, Reply] | None:
    if not _claim_open(session, case_id):
        return None
    case = session.get(Case, case_id)
    assert case is not None
    ctx = _ctx(rt, session, case)
    ctx.rec.audit("case.status", status=CaseStatus.IN_PROGRESS.value, previous="OPEN")
    try:
        reply = _run_playbook(ctx)
    except Exception as exc:  # noqa: BLE001 - a case must never crash the worker
        log.exception("case_failed", extra={"case_id": case_id})
        session.rollback()
        case = session.get(Case, case_id)
        assert case is not None
        ctx = _ctx(rt, session, case)
        ctx.rec.step(
            StepKind.ACT,
            StepStatus.FAILED,
            "Unexpected error; escalating to a person",
            error=type(exc).__name__,
        )
        if case.status == CaseStatus.IN_PROGRESS.value:
            reply = ctx.manual_review(
                "system_error", "an unexpected error stopped automation", {"error": str(exc)[:200]}
            )
        else:
            reply = Reply("handoff")
    session.refresh(case)
    return case, reply


def run_cases(rt: Runtime, case_ids: list[int]) -> None:
    """Background entry point: process a message's cases in order, then reply once."""
    with rt.session_factory() as session:
        results: list[tuple[int, CaseStatus, Reply]] = []
        conversation_id: int | None = None
        language = "en"
        for case_id in case_ids:
            done = process_case(rt, session, case_id)
            if done is None:
                continue
            case, reply = done
            conversation_id, language = case.conversation_id, case.language
            results.append((case.id, CaseStatus(case.status), reply))
        if conversation_id is None or not results:
            return
        text = compose(results, language)  # type: ignore[arg-type]
        card = card_for(results, _uploads(session, [r[0] for r in results]))
        spec = replies_render([r for _, _, r in results])
        post_saathi(session, conversation_id, text, card, case_id=results[0][0], spec=spec)
        for case_id, _, _ in results:
            replied = session.get(Case, case_id)
            assert replied is not None
            CaseRecorder(session, replied).step(
                StepKind.REPLY, StepStatus.OK, "Replied to merchant", text=text
            )


def _uploads(session: Session, case_ids: list[int]) -> list[dict[str, Any]]:
    rows = session.scalars(
        select(Case).where(Case.id.in_(case_ids), Case.status == CaseStatus.WAITING_MERCHANT.value)
    )
    return [{"case_id": c.id, "doc_type": c.waiting_for} for c in rows if c.waiting_for]


def _post_followup(session: Session, case: Case, reply: Reply) -> None:
    text = render(reply, case.language)  # type: ignore[arg-type]
    card = card_for([(case.id, CaseStatus(case.status), reply)], _uploads(session, [case.id]))
    post_saathi(
        session, case.conversation_id, text, card, case_id=case.id, spec=replies_render([reply])
    )
    CaseRecorder(session, case).step(
        StepKind.REPLY, StepStatus.OK, "Replied to merchant", text=text
    )


def receive_document(
    rt: Runtime, session: Session, case_id: int, merchant_id: int, doc_type: str
) -> Case:
    case = session.get(Case, case_id)
    if case is None or case.merchant_id != merchant_id:
        raise AppError("unknown_case", "Case not found", 404)
    if case.status != CaseStatus.WAITING_MERCHANT.value or case.waiting_for != doc_type:
        raise AppError("not_waiting", "This case is not waiting for that document", 409)
    ctx = _ctx(rt, session, case)
    ctx.rec.audit("document.submitted", actor=f"merchant:{merchant_id}", doc_type=doc_type)
    ctx.rec.transition(CaseStatus.IN_PROGRESS)
    try:
        doc = ctx.conn.settlement.submit_document(merchant_id, doc_type)
        ctx.rec.step(
            StepKind.ACT,
            StepStatus.OK,
            f"Received and checked {doc_type} (simulated check)",
            system="KYC (simulated)",
        )
        ok = doc.status == "VERIFIED"
        ctx.rec.step(
            StepKind.PROVE,
            StepStatus.OK if ok else StepStatus.FAILED,
            f"Re-checked: {doc_type} status {doc.status}",
            system="KYC (simulated)",
        )
        case.waiting_for = None
        reply = (
            prepare_release(ctx)
            if ok
            else ctx.manual_review("proof_failed", f"{doc_type} did not verify", {"doc": doc_type})
        )
    except ConnectorError as exc:
        reply = ctx.manual_review("system_error", str(exc)[:200], {"doc": doc_type})
    session.refresh(case)
    _post_followup(session, case, reply)
    return case


def decide_approval(
    rt: Runtime, session: Session, approval_id: int, user: User, approve: bool, note: str | None
) -> Case:
    if not approve and not (note and note.strip()):
        raise AppError("note_required", "A reason is required when rejecting", 422)
    claimed = session.execute(
        update(Approval)
        .where(Approval.id == approval_id, Approval.status == "PENDING")
        .values(
            status="APPROVED" if approve else "REJECTED",
            decided_at=datetime.now(UTC),
            decided_by_user_id=user.id,
            decision_note=(note or "").strip()[:240] or None,
        )
        .returning(Approval.id)
    ).first()
    session.commit()
    if claimed is None:
        raise AppError("already_decided", "This approval was already decided", 409)
    approval = session.get(Approval, approval_id)
    assert approval is not None
    case = session.get(Case, approval.case_id)
    assert case is not None
    ctx = _ctx(rt, session, case)
    actor = f"user:{user.email}"
    ctx.rec.audit(
        "approval.decided",
        actor=actor,
        approval_id=approval.id,
        approved=approve,
        action=approval.action,
        rule_id=approval.rule_id,
    )
    case.handled_by_person = True

    if not approve:
        reply = ctx.finish(
            CaseStatus.REJECTED, Reply("rejected", {"note": approval.decision_note or "-"}), actor
        )
        session.refresh(case)
        _post_followup(session, case, reply)
        return case

    ctx.rec.transition(CaseStatus.IN_PROGRESS, actor=actor)
    if approval.action == "manual_review":
        reply = ctx.finish(CaseStatus.RESOLVED, Reply("person_resolved"), actor)
    else:
        ctx.rec.step(
            StepKind.DECIDE,
            StepStatus.OK,
            f"Approved by {user.name}: {approval.action}",
            approver=user.email,
            overrides_rule=approval.rule_id,
        )
        params: dict[str, Any] = dict(approval.params)
        kwargs = {k: v for k, v in params.items() if k not in {"amount", "days"}}
        try:
            out = run_action(
                ctx, approval.action, amount=approval.amount_inr, approver_id=user.id, **kwargs
            )
        except ConnectorError as exc:
            out = None
            ctx.rec.step(
                StepKind.ACT, StepStatus.FAILED, "System error after approval", error=str(exc)
            )
        if out and out.ok and out.proved:
            reply = ctx.finish(
                CaseStatus.RESOLVED, success_reply(ctx, approval.action, out, params), actor
            )
        else:
            ctx.rec.step(StepKind.HANDOFF, StepStatus.FAILED, "Approved action could not be proved")
            reply = ctx.finish(CaseStatus.FAILED, Reply("handoff"), actor)
    session.refresh(case)
    _post_followup(session, case, reply)
    return case


def pending_case_ids(session: Session) -> list[int]:
    return list(session.scalars(select(Case.id).where(Case.status == CaseStatus.OPEN.value)))
