"""Idempotent action execution: ACT, then PROVE against the system of record."""

import time
from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.connectors.base import ConnectorError
from app.db.models import ActionRecord
from app.domain.types import StepKind, StepStatus
from app.services.context import Ctx
from app.services.replies import CardItem, Reply, fmt_inr

REFUND_POLLS = 6
POLL_INTERVAL_S = 0.0  # simulated gateway answers immediately; raise for real gateways


@dataclass(frozen=True)
class ActionOutcome:
    ok: bool  # the system accepted the action
    proved: bool | None  # True/False after re-check, None when proof is deferred
    reference: str | None = None
    detail: str = ""
    data: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class _Spec:
    title: str
    system: str
    act: Callable[[Ctx, dict[str, Any], str], ActionOutcome]
    prove: Callable[[Ctx, dict[str, Any], ActionOutcome], tuple[bool | None, str]]


def _remote_fix(ctx: Ctx, p: dict[str, Any], key: str) -> ActionOutcome:
    r = ctx.conn.device.remote_fix(p["device_id"])
    return ActionOutcome(r.success, None, detail=r.detail)


def _prove_online(ctx: Ctx, p: dict[str, Any], out: ActionOutcome) -> tuple[bool | None, str]:
    st = ctx.conn.device.get_status(p["device_id"])
    ok = st.status == "ONLINE" and st.pairing_ok
    return ok, f"device status {st.status}, pairing {'OK' if st.pairing_ok else 'BROKEN'}"


def _repair(ctx: Ctx, p: dict[str, Any], key: str) -> ActionOutcome:
    r = ctx.conn.device.repair(p["device_id"])
    return ActionOutcome(r.success, None, detail=r.detail)


def _replace(ctx: Ctx, p: dict[str, Any], key: str) -> ActionOutcome:
    r = ctx.conn.logistics.create_replacement(p["device_id"], key)
    return ActionOutcome(True, None, reference=r.reference, detail=f"order {r.status}")


def _prove_order(ctx: Ctx, p: dict[str, Any], out: ActionOutcome) -> tuple[bool | None, str]:
    assert out.reference
    order = ctx.conn.logistics.get_order(out.reference)
    return True, f"order {order.reference} found in logistics ({order.status})"


def _order_eta(ctx: Ctx, out: ActionOutcome) -> dict[str, Any]:
    assert out.reference
    return {"eta": ctx.conn.logistics.get_order(out.reference).eta_date}


def _reverse_rent(ctx: Ctx, p: dict[str, Any], key: str) -> ActionOutcome:
    r = ctx.conn.billing.reverse_rent(p["rental_id"], Decimal(p["amount"]), key)
    return ActionOutcome(True, None, reference=r.reference, detail=r.status)


def _prove_reversal(ctx: Ctx, p: dict[str, Any], out: ActionOutcome) -> tuple[bool | None, str]:
    assert out.reference
    r = ctx.conn.billing.get_reversal(out.reference)
    return r.status == "SUCCESS", f"reversal {r.reference} status {r.status}"


def _refund(ctx: Ctx, p: dict[str, Any], key: str) -> ActionOutcome:
    refund_id = f"saathi-case-{ctx.case.id}"
    r = ctx.conn.gateway.initiate_refund(refund_id, p["txn"], Decimal(p["amount"]))
    return ActionOutcome(True, None, reference=r.refund_id, detail=f"gateway status {r.status}")


def _prove_refund(ctx: Ctx, p: dict[str, Any], out: ActionOutcome) -> tuple[bool | None, str]:
    assert out.reference
    status = "PENDING"
    for _ in range(REFUND_POLLS):
        status = ctx.conn.gateway.get_refund_status(out.reference).status
        if status != "PENDING":
            break
        time.sleep(POLL_INTERVAL_S)
    return status == "SUCCESS", f"refund status API: {status}"


def _release(ctx: Ctx, p: dict[str, Any], key: str) -> ActionOutcome:
    r = ctx.conn.settlement.release_hold(p["merchant_id"], key)
    return ActionOutcome(True, None, reference=r.reference, detail=r.status)


def _prove_released(ctx: Ctx, p: dict[str, Any], out: ActionOutcome) -> tuple[bool | None, str]:
    still_held = ctx.conn.settlement.get_held_settlement(p["merchant_id"]) is not None
    return (not still_held), "settlement no longer on hold" if not still_held else "still HELD"


def _request_doc(ctx: Ctx, p: dict[str, Any], key: str) -> ActionOutcome:
    return ActionOutcome(True, None, reference=f"DOC-{p['doc_type']}", detail="asked once")


def _defer(ctx: Ctx, p: dict[str, Any], out: ActionOutcome) -> tuple[bool | None, str]:
    return None, "proof deferred until the document is received and checked"


SPECS: dict[str, _Spec] = {
    "remote_fix": _Spec("Remote fix on device", "device system", _remote_fix, _prove_online),
    "repair_device": _Spec("Re-pair device", "device system", _repair, _prove_online),
    "replace_device": _Spec("Create replacement order", "logistics", _replace, _prove_order),
    "reverse_rent": _Spec("Reverse rent", "rental billing", _reverse_rent, _prove_reversal),
    "refund_bill": _Spec("Refund failed bill payment", "payment gateway", _refund, _prove_refund),
    "release_settlement_hold": _Spec(
        "Release settlement hold", "settlement ledger", _release, _prove_released
    ),
    "request_document": _Spec("Ask merchant for one document", "KYC", _request_doc, _defer),
}


def _claim(ctx: Ctx, name: str, key: str, amount: Decimal | None, approver_id: int | None):  # type: ignore[no-untyped-def]
    """Insert the action row. The unique key makes a second execution impossible."""
    row = ActionRecord(
        case_id=ctx.case.id,
        name=name,
        idempotency_key=key,
        amount_inr=amount,
        approved_by_user_id=approver_id,
    )
    ctx.session.add(row)
    try:
        ctx.session.commit()
        return row, True
    except IntegrityError:
        ctx.session.rollback()
        existing = ctx.session.scalars(
            select(ActionRecord).where(ActionRecord.idempotency_key == key)
        ).one()
        return existing, False


def run_action(
    ctx: Ctx,
    name: str,
    amount: Decimal | None = None,
    approver_id: int | None = None,
    **params: Any,
) -> ActionOutcome:
    spec = SPECS[name]
    key = f"case:{ctx.case.id}:{name}"
    row, created = _claim(ctx, name, key, amount, approver_id)
    prior_ref = row.reference

    if created or row.status == "PENDING":
        try:
            out = spec.act(ctx, {**params, "amount": amount}, key)
        except ConnectorError as exc:
            row.status = "FAILED"
            ctx.session.commit()
            ctx.rec.step(
                StepKind.ACT,
                StepStatus.FAILED,
                f"{spec.title}: system error",
                system=f"{spec.system} (simulated)",
                error=str(exc),
                action_id=row.id,
            )
            return ActionOutcome(False, False, detail=str(exc))
        row.status = "DONE" if out.ok else "FAILED"
        row.reference = out.reference
        ctx.session.commit()
        ctx.rec.step(
            StepKind.ACT,
            StepStatus.OK if out.ok else StepStatus.FAILED,
            f"{spec.title}" + ("" if out.ok else ": did not work"),
            system=f"{spec.system} (simulated)",
            action_id=row.id,
            idempotency_key=key,
            reference=out.reference,
            detail=out.detail,
            approver_id=approver_id,
        )
    else:  # already executed earlier: never call the system again, only re-verify
        out = ActionOutcome(row.status == "DONE", None, reference=prior_ref, detail="already done")
        ctx.rec.step(
            StepKind.ACT,
            StepStatus.INFO,
            f"{spec.title}: already executed, skipped",
            action_id=row.id,
            idempotency_key=key,
            reference=prior_ref,
        )

    if not out.ok:
        return out

    proved, detail = spec.prove(ctx, {**params, "amount": amount}, out)
    row.proved = proved
    ctx.session.commit()
    if proved is not None:
        ctx.rec.step(
            StepKind.PROVE,
            StepStatus.OK if proved else StepStatus.FAILED,
            f"Re-checked: {detail}",
            system=f"{spec.system} (simulated)",
            action_id=row.id,
            reference=out.reference,
        )
    data = _order_eta(ctx, out) if name == "replace_device" and proved else {}
    return ActionOutcome(True, proved, out.reference, detail, data)


def success_reply(ctx: Ctx, name: str, out: ActionOutcome, params: dict[str, Any]) -> Reply:
    """The merchant-facing result for a proved action. Called by playbooks and approvals."""
    ref = out.reference or "-"
    eta = out.data.get("eta")
    eta_text = eta.strftime("%d %b") if eta else "-"
    match name:
        case "remote_fix":
            return Reply("device_fixed_remote")
        case "repair_device":
            return Reply("card_repaired")
        case "replace_device":
            key = "card_replaced" if ctx.pack.skill_pack == "card_machine" else "device_replaced"
            return Reply(key, {"eta": eta_text}, [CardItem("Replacement", ref, "Created")])
        case "reverse_rent":
            return Reply(
                "rent_reversed",
                {"days": str(params.get("days", "-")), "amount": fmt_inr(params["amount"])},
                [CardItem("Refund", ref, "Success")],
            )
        case "refund_bill":
            return Reply(
                "bill_refunded",
                {"amount": fmt_inr(params["amount"])},
                [CardItem("Refund", ref, "Success")],
            )
        case "release_settlement_hold":
            return Reply("settlement_released", items=[CardItem("Hold release", ref, "Done")])
    raise ValueError(f"no success reply for {name}")
