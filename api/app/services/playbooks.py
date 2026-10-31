"""Per-product playbooks. Each reads systems, asks the rules engine, acts, proves.

A playbook never decides on its own whether an action is allowed: it asks ctx.decide().
"""

from collections.abc import Callable
from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import func, select

from app.connectors.base import DeviceStatus
from app.db.models import ActionRecord, Case
from app.domain.types import CaseStatus, Intent
from app.rules.engine import Outcome
from app.services.actions import run_action, success_reply
from app.services.context import Ctx, lookup_step
from app.services.replies import Reply, doc_label, fmt_inr

Playbook = Callable[[Ctx], Reply]


def _device_summary(d: DeviceStatus) -> dict[str, object]:
    return {
        "status": d.status,
        "offline_hours": d.offline_hours,
        "sim_signal": d.sim_signal,
        "pairing_ok": d.pairing_ok,
    }


def _replace_flow(ctx: Ctx, device: DeviceStatus, evidence: dict[str, object]) -> Reply:
    decision = ctx.decide("replace_device", ctx.facts())
    if decision.outcome is not Outcome.ALLOW:
        return ctx.hand_off(
            decision, "replace_device", evidence, params={"device_id": device.device_id}
        )
    out = run_action(ctx, "replace_device", device_id=device.device_id)
    if out.ok and out.proved:
        return ctx.finish(CaseStatus.RESOLVED, success_reply(ctx, "replace_device", out, {}))
    return ctx.manual_review("proof_failed", "replacement order could not be verified", evidence)


def device_fault(ctx: Ctx, kind: str = "SOUNDBOX") -> Reply:
    device = ctx.conn.device.find_device(ctx.case.merchant_id, kind)
    if device is None:
        return ctx.manual_review("records_mismatch", f"no {kind} on this merchant", {})
    evidence = _device_summary(device)
    lookup_step(
        ctx,
        f"Device: {device.status}, offline {device.offline_hours}h, SIM {device.sim_signal}",
        "device system",
        **evidence,
    )
    if device.status == "ONLINE" and device.pairing_ok:
        return ctx.finish(CaseStatus.RESOLVED, Reply("device_already_online"))

    fix = "repair_device" if kind == "CARD_MACHINE" else "remote_fix"
    decision = ctx.decide(fix, ctx.facts())
    if decision.outcome is not Outcome.ALLOW:
        return ctx.hand_off(decision, fix, evidence, params={"device_id": device.device_id})
    out = run_action(ctx, fix, device_id=device.device_id)
    if out.ok and out.proved:
        return ctx.finish(CaseStatus.RESOLVED, success_reply(ctx, fix, out, {}))

    from app.domain.types import StepKind, StepStatus

    ctx.rec.step(
        StepKind.LOOKUP, StepStatus.INFO, "Fix did not bring the device back: marked hardware fault"
    )
    return _replace_flow(ctx, device, evidence)


def card_machine_issue(ctx: Ctx) -> Reply:
    return device_fault(ctx, "CARD_MACHINE")


def rent_dispute(ctx: Ctx) -> Reply:
    device = ctx.conn.device.find_device(ctx.case.merchant_id, "SOUNDBOX")
    if device is None:
        return ctx.manual_review("records_mismatch", "no Soundbox rental on this merchant", {})
    rental = ctx.conn.billing.get_rental(device.device_id)
    days = device.offline_hours // 24
    per_day = rental.monthly_rent_inr / Decimal(int(ctx.pack.params.get("days_in_month", 30)))
    amount = (per_day * days).quantize(Decimal("0.01"), ROUND_HALF_UP)
    evidence = {
        "monthly_rent_inr": rental.monthly_rent_inr,
        "down_days": days,
        "prior_reversals": rental.prior_reversal_count,
        "amount_inr": amount,
    }
    lookup_step(
        ctx,
        f"Rental ₹{fmt_inr(rental.monthly_rent_inr)}/month, {days} down days -> ₹{fmt_inr(amount)}",
        "rental billing",
        **evidence,
    )
    if days < 1:
        return ctx.finish(CaseStatus.RESOLVED, Reply("rent_no_downtime"))

    decision = ctx.decide("reverse_rent", ctx.facts(rental.prior_reversal_count), amount=amount)
    params = {"rental_id": rental.rental_id, "days": days, "amount": str(amount)}
    if decision.outcome is not Outcome.ALLOW:
        return ctx.hand_off(decision, "reverse_rent", evidence, amount=amount, params=params)
    out = run_action(ctx, "reverse_rent", amount=amount, rental_id=rental.rental_id)
    if out.ok and out.proved:
        return ctx.finish(CaseStatus.RESOLVED, success_reply(ctx, "reverse_rent", out, params))
    return ctx.manual_review("proof_failed", "rent reversal could not be verified", evidence)


def _already_asked(ctx: Ctx, doc_type: str) -> bool:
    count = ctx.session.scalar(
        select(func.count())
        .select_from(ActionRecord)
        .join(Case, Case.id == ActionRecord.case_id)
        .where(
            Case.merchant_id == ctx.case.merchant_id,
            ActionRecord.name == "request_document",
            ActionRecord.reference == f"DOC-{doc_type}",
            ActionRecord.case_id != ctx.case.id,
        )
    )
    return bool(count)


def prepare_release(ctx: Ctx) -> Reply:
    """Everything is in place: package the case for the risk team's one-click approval."""
    held = ctx.conn.settlement.get_held_settlement(ctx.case.merchant_id)
    docs = ctx.conn.settlement.get_kyc_documents(ctx.case.merchant_id)
    evidence = {
        "held_amount_inr": held.amount_inr if held else None,
        "hold_reason": held.hold_reason if held else None,
        "documents": {d.doc_type: d.status for d in docs},
    }
    decision = ctx.decide("release_settlement_hold", ctx.facts())
    return ctx.hand_off(
        decision,
        "release_settlement_hold",
        evidence,
        params={"merchant_id": ctx.case.merchant_id},
        reply_key="settlement_sent_to_risk" if decision.rule_id == "requires_person" else "handoff",
    )


def settlement_held(ctx: Ctx) -> Reply:
    held = ctx.conn.settlement.get_held_settlement(ctx.case.merchant_id)
    if held is None:
        return ctx.finish(CaseStatus.RESOLVED, Reply("settlement_none"))
    docs = ctx.conn.settlement.get_kyc_documents(ctx.case.merchant_id)
    missing = [d.doc_type for d in docs if d.status != "VERIFIED"]
    evidence = {
        "held_amount_inr": held.amount_inr,
        "hold_reason": held.hold_reason,
        "missing_documents": missing,
    }
    lookup_step(
        ctx,
        f"Settlement ₹{fmt_inr(held.amount_inr)} on HOLD ({held.hold_reason}); missing: "
        f"{', '.join(missing) or 'none'}",
        "settlement ledger + KYC",
        **evidence,
    )
    if held.hold_reason == "KYC_DOCUMENT_MISSING" and len(missing) == 1:
        doc = missing[0]
        if _already_asked(ctx, doc):
            return ctx.manual_review(
                "records_mismatch",
                f"{doc} was already requested before; a person must follow up",
                evidence,
            )
        decision = ctx.decide("request_document", ctx.facts())
        if decision.outcome is not Outcome.ALLOW:
            return ctx.hand_off(decision, "request_document", evidence)
        run_action(ctx, "request_document", doc_type=doc)
        ctx.case.waiting_for = doc
        ctx.rec.transition(CaseStatus.WAITING_MERCHANT)
        return Reply("settlement_need_doc", {"doc": doc_label(doc, ctx.language)})
    if not missing:
        return prepare_release(ctx)
    return ctx.manual_review(
        "records_mismatch", "hold reason and KYC records do not match", evidence
    )


def bill_payment_failed(ctx: Ctx) -> Reply:
    bills = ctx.conn.biller.list_bills(ctx.case.merchant_id)
    failed = [b for b in bills if b.debited and b.biller_status == "FAILED"]
    if not failed:
        bills_ev: dict[str, object] = {
            "bills": [
                {
                    "txn": b.gateway_txn_id,
                    "biller_status": b.biller_status,
                    "amount_inr": b.amount_inr,
                }
                for b in bills
            ]
        }
        lookup_step(ctx, "No debited bill with a FAILED biller status found", "biller", **bills_ev)
        return ctx.manual_review(
            "records_mismatch",
            "merchant reports a failed bill but biller records disagree",
            bills_ev,
        )
    bill = failed[0]  # most recent
    days = int(ctx.pack.params.get("refund_deadline_days", 5))
    ctx.case.refund_deadline_at = bill.paid_at + timedelta(days=days)
    evidence = {
        "txn": bill.gateway_txn_id,
        "biller": bill.biller,
        "amount_inr": bill.amount_inr,
        "biller_status": bill.biller_status,
    }
    lookup_step(
        ctx,
        f"{bill.biller} ₹{fmt_inr(bill.amount_inr)}: debited, biller says FAILED",
        "biller + payment gateway",
        **evidence,
    )
    decision = ctx.decide("refund_bill", ctx.facts(), amount=bill.amount_inr)
    params = {"txn": bill.gateway_txn_id, "amount": str(bill.amount_inr)}
    if decision.outcome is not Outcome.ALLOW:
        return ctx.hand_off(
            decision, "refund_bill", evidence, amount=bill.amount_inr, params=params
        )
    out = run_action(ctx, "refund_bill", amount=bill.amount_inr, txn=bill.gateway_txn_id)
    if out.ok and out.proved:
        return ctx.finish(CaseStatus.RESOLVED, success_reply(ctx, "refund_bill", out, params))
    return ctx.manual_review("proof_failed", "refund did not reach SUCCESS", evidence)


PLAYBOOKS: dict[str, Playbook] = {
    Intent.DEVICE_FAULT: device_fault,
    Intent.RENT_DISPUTE: rent_dispute,
    Intent.CARD_MACHINE_ISSUE: card_machine_issue,
    Intent.SETTLEMENT_HELD: settlement_held,
    Intent.BILL_PAYMENT_FAILED: bill_payment_failed,
}
