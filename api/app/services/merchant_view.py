"""Read models for the merchant dashboard.

These read the same tables the simulated back-office systems write, so whatever Saathi fixes
(device back online, rent reversed, refund done, hold released) shows up here without any
special wiring: the dashboard is just another consumer of the systems of record.
"""

from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import (
    ActionRecord,
    BillPayment,
    Case,
    CaseStep,
    Collection,
    Device,
    KycDocument,
    Merchant,
    Rental,
    RentCharge,
    RentReversal,
    ReplacementOrder,
    Settlement,
    SimulatedRefund,
)
from app.domain.types import TERMINAL_STATUSES, CaseStatus

IST_OFFSET = timedelta(hours=5, minutes=30)

# What "Resolve with Saathi" sends on the merchant's behalf, in the merchant's own language.
_DEVICE_NAME = {
    "SOUNDBOX": {"hi": "साउंडबॉक्स", "hinglish": "soundbox", "en": "soundbox"},
    "CARD_MACHINE": {"hi": "कार्ड मशीन", "hinglish": "card machine", "en": "card machine"},
}
_ASK = {
    "device_offline": {
        "hi": "मेरा {name} {serial} {hrs} घंटे से बंद है",
        "hinglish": "Mera {name} {serial} {hrs} ghante se band hai",
        "en": "My {name} {serial} has been offline for {hrs} hours",
    },
    "rent_while_down": {
        "hi": "मेरा किराया कट गया",
        "hinglish": "Mera rent kat gaya",
        "en": "I was charged rent while my device was down",
    },
    "settlement_held": {
        "hi": "मेरा सेटलमेंट रुका हुआ है",
        "hinglish": "Mera settlement ruka hua hai",
        "en": "My settlement is on hold",
    },
    "bill_failed": {
        "hi": "मेरा बिल पेमेंट फेल हो गया और पैसे कट गए",
        "hinglish": "Mera {biller} bill payment fail ho gaya aur paise kat gaye",
        "en": "My {biller} bill payment failed but the money was debited",
    },
}


def _ask(which: str, lang: str, **kw: Any) -> str:
    if which == "device_offline":
        kw["name"] = _DEVICE_NAME[kw.pop("kind")][lang]
        if not kw.get("hrs"):  # no downtime figure: say it simply
            return {
                "hi": "मेरा {name} {serial} बंद है",
                "hinglish": "Mera {name} {serial} band hai",
                "en": "My {name} {serial} is offline",
            }[lang].format(**kw)
    return _ASK[which][lang].format(**kw)


def _utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


def _offline_hours(device: Device, now: datetime) -> int:
    if device.status != "OFFLINE":
        return 0
    return int((now - _utc(device.last_seen_at)).total_seconds() // 3600)


def devices(
    session: Session, merchant_id: int, now: datetime | None = None
) -> list[dict[str, Any]]:
    now = now or datetime.now(UTC)
    out: list[dict[str, Any]] = []
    for d in session.scalars(
        select(Device).where(Device.merchant_id == merchant_id).order_by(Device.id)
    ):
        rental = session.scalars(select(Rental).where(Rental.device_id == d.id)).first()
        order = session.scalars(
            select(ReplacementOrder)
            .where(ReplacementOrder.device_id == d.id)
            .order_by(ReplacementOrder.id.desc())
        ).first()
        out.append(
            {
                "id": d.id,
                "kind": d.kind,
                "serial": d.serial,
                "status": d.status,
                "offline_hours": _offline_hours(d, now),
                "sim_signal": d.sim_signal,
                "pairing_ok": d.pairing_ok,
                "last_seen_at": _utc(d.last_seen_at),
                "monthly_rent_inr": rental.monthly_rent_inr if rental else None,
                "replacement": (
                    {
                        "reference": order.reference,
                        "status": order.status,
                        "eta_date": _utc(order.eta_date),
                    }
                    if order
                    else None
                ),
            }
        )
    return out


def settlements(session: Session, merchant_id: int) -> dict[str, Any]:
    rows = session.scalars(
        select(Settlement)
        .where(Settlement.merchant_id == merchant_id)
        .order_by(Settlement.created_at.desc())
    )
    docs = session.scalars(
        select(KycDocument).where(KycDocument.merchant_id == merchant_id).order_by(KycDocument.id)
    )
    return {
        "settlements": [
            {
                "id": s.id,
                "amount_inr": s.amount_inr,
                "status": s.status,
                "hold_reason": s.hold_reason,
                "created_at": _utc(s.created_at),
            }
            for s in rows
        ],
        "documents": [{"doc_type": d.doc_type, "status": d.status} for d in docs],
    }


def bills(session: Session, merchant_id: int) -> list[dict[str, Any]]:
    out = []
    for b in session.scalars(
        select(BillPayment)
        .where(BillPayment.merchant_id == merchant_id)
        .order_by(BillPayment.paid_at.desc())
    ):
        refund = session.scalars(
            select(SimulatedRefund).where(SimulatedRefund.gateway_txn_id == b.gateway_txn_id)
        ).first()
        out.append(
            {
                "txn": b.gateway_txn_id,
                "biller": b.biller,
                "amount_inr": b.amount_inr,
                "debited": b.debited,
                "biller_status": b.biller_status,
                "paid_at": _utc(b.paid_at),
                "refund": (
                    {
                        "refund_id": refund.refund_id,
                        "status": refund.status,
                        "amount_inr": refund.amount_inr,
                    }
                    if refund
                    else None
                ),
            }
        )
    return out


def activity(session: Session, merchant_id: int, limit: int = 40) -> list[dict[str, Any]]:
    """One ledger of money in and out, newest first, built from every system that moves money."""
    items: list[dict[str, Any]] = []
    for c in session.scalars(
        select(Collection)
        .where(Collection.merchant_id == merchant_id)
        .order_by(Collection.paid_at.desc())
        .limit(limit)
    ):
        items.append(
            {
                "id": f"col-{c.id}",
                "ts": _utc(c.paid_at),
                "kind": "payment_received",
                "title": "Payment received",
                "subtitle": c.payer,
                "amount_inr": c.amount_inr,
                "status": "SUCCESS",
                "reference": None,
            }
        )
    for s in session.scalars(select(Settlement).where(Settlement.merchant_id == merchant_id)):
        label = {
            "PAID": "Settled to bank",
            "HELD": "Settlement on hold",
            "RELEASED": "Settlement released",
        }[s.status]
        items.append(
            {
                "id": f"set-{s.id}",
                "ts": _utc(s.created_at),
                "kind": "settlement",
                "title": label,
                "subtitle": "Payout to your bank account",
                "amount_inr": s.amount_inr,
                "status": s.status,
                "reference": None,
            }
        )
    for rc, _rental in session.execute(
        select(RentCharge, Rental)
        .join(Rental, Rental.id == RentCharge.rental_id)
        .where(Rental.merchant_id == merchant_id)
    ):
        items.append(
            {
                "id": f"rent-{rc.id}",
                "ts": _utc(rc.charged_at),
                "kind": "rent_charge",
                "title": "Soundbox rent",
                "subtitle": "Monthly device rental",
                "amount_inr": -rc.amount_inr,
                "status": "SUCCESS",
                "reference": None,
            }
        )
    for rv, _rental in session.execute(
        select(RentReversal, Rental)
        .join(Rental, Rental.id == RentReversal.rental_id)
        .where(Rental.merchant_id == merchant_id)
    ):
        items.append(
            {
                "id": f"rv-{rv.id}",
                "ts": _utc(rv.created_at),
                "kind": "rent_reversal",
                "title": "Rent reversed",
                "subtitle": "Credited for device downtime",
                "amount_inr": rv.amount_inr,
                "status": rv.status,
                "reference": rv.reference,
            }
        )
    for b in session.scalars(select(BillPayment).where(BillPayment.merchant_id == merchant_id)):
        items.append(
            {
                "id": f"bill-{b.id}",
                "ts": _utc(b.paid_at),
                "kind": "bill_payment",
                "title": b.biller,
                "subtitle": f"Bill payment · biller status {b.biller_status.lower()}",
                "amount_inr": -b.amount_inr,
                "status": b.biller_status,
                "reference": b.gateway_txn_id,
            }
        )
        for r in session.scalars(
            select(SimulatedRefund).where(SimulatedRefund.gateway_txn_id == b.gateway_txn_id)
        ):
            items.append(
                {
                    "id": f"ref-{r.id}",
                    "ts": _utc(r.created_at),
                    "kind": "refund",
                    "title": "Refund",
                    "subtitle": f"{b.biller} refund",
                    "amount_inr": r.amount_inr,
                    "status": r.status,
                    "reference": r.refund_id,
                }
            )
    items.sort(key=lambda i: i["ts"], reverse=True)
    return items[:limit]


def help_requests(session: Session, merchant_id: int, limit: int = 30) -> list[dict[str, Any]]:
    """The merchant's own cases, with only merchant-safe steps (no rule internals or evidence)."""
    out = []
    for c in session.scalars(
        select(Case).where(Case.merchant_id == merchant_id).order_by(Case.id.desc()).limit(limit)
    ):
        steps = session.scalars(
            select(CaseStep)
            .where(CaseStep.case_id == c.id, CaseStep.kind.in_(["ACT", "PROVE", "HANDOFF"]))
            .order_by(CaseStep.seq)
        )
        refs = [
            a.reference
            for a in session.scalars(select(ActionRecord).where(ActionRecord.case_id == c.id))
            if a.reference
        ]
        out.append(
            {
                "id": c.id,
                "summary": c.summary,
                "product": c.product,
                "status": c.status,
                "created_at": _utc(c.created_at),
                "resolved_at": _utc(c.resolved_at) if c.resolved_at else None,
                "references": refs,
                "waiting_for": c.waiting_for,
                "steps": [
                    {"kind": s.kind, "status": s.status, "title": s.title, "at": _utc(s.created_at)}
                    for s in steps
                ],
            }
        )
    return out


def overview(session: Session, merchant: Merchant, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    ist_now = now + IST_OFFSET
    day_start = ist_now.replace(hour=0, minute=0, second=0, microsecond=0) - IST_OFFSET

    def total(since: datetime) -> tuple[Decimal, int]:
        row = session.execute(
            select(func.coalesce(func.sum(Collection.amount_inr), 0), func.count()).where(
                Collection.merchant_id == merchant.id, Collection.paid_at >= since
            )
        ).one()
        return Decimal(row[0]), int(row[1])

    today_amt, today_n = total(day_start)
    week_amt, week_n = total(day_start - timedelta(days=6))
    devs = devices(session, merchant.id, now)
    sets = settlements(session, merchant.id)["settlements"]
    held = next((s for s in sets if s["status"] == "HELD"), None)
    last_paid = next((s for s in sets if s["status"] in {"PAID", "RELEASED"}), None)
    open_requests = (
        session.scalar(
            select(func.count())
            .select_from(Case)
            .where(
                Case.merchant_id == merchant.id,
                Case.status.not_in([s.value for s in TERMINAL_STATUSES]),
            )
        )
        or 0
    )

    lang = merchant.language if merchant.language in {"hi", "hinglish", "en"} else "en"
    alerts: list[dict[str, Any]] = []
    for d in devs:
        name = "Soundbox" if d["kind"] == "SOUNDBOX" else "Card machine"
        hrs = d["offline_hours"]
        if d["status"] == "OFFLINE" and not d["replacement"]:
            alerts.append(
                {
                    "id": f"dev-{d['id']}",
                    "severity": "critical",
                    "kind": "device_offline",
                    "title": f"{name} {d['serial']} is offline",
                    "body": f"No signal for {hrs} hours." if hrs else "It has lost its connection.",
                    "ask": _ask(
                        "device_offline", lang, kind=d["kind"], serial=d["serial"], hrs=hrs
                    ),
                }
            )
        rental = session.scalars(select(Rental).where(Rental.device_id == d["id"])).first()
        if rental and d["kind"] == "SOUNDBOX" and hrs >= 24:
            reversed_before = session.scalar(
                select(func.count())
                .select_from(RentReversal)
                .where(RentReversal.rental_id == rental.id)
            )
            if not reversed_before:
                alerts.append(
                    {
                        "id": f"rent-{rental.id}",
                        "severity": "warning",
                        "kind": "rent_while_down",
                        "title": "Rent was charged while your device was down",
                        "body": f"Your {name} has been offline for {hrs} hours. You may be owed part of the rent.",
                        "ask": _ask("rent_while_down", lang),
                    }
                )
    if held:
        alerts.append(
            {
                "id": f"set-{held['id']}",
                "severity": "warning",
                "kind": "settlement_held",
                "title": "A settlement is on hold",
                "body": "A payout is waiting on a missing document.",
                "ask": _ask("settlement_held", lang),
            }
        )
    for b in bills(session, merchant.id):
        if b["debited"] and b["biller_status"] == "FAILED" and not b["refund"]:
            alerts.append(
                {
                    "id": f"bill-{b['txn']}",
                    "severity": "warning",
                    "kind": "bill_failed",
                    "title": f"{b['biller']} payment failed",
                    "body": "Money was debited but the bill was not paid.",
                    "ask": _ask("bill_failed", lang, biller=b["biller"]),
                }
            )
    return {
        "merchant": {
            "id": merchant.id,
            "name": merchant.name,
            "city": merchant.city,
            "category": merchant.category,
            "language": merchant.language,
            "kyc_status": merchant.kyc_status,
        },
        "collections": {
            "today_inr": today_amt,
            "today_count": today_n,
            "week_inr": week_amt,
            "week_count": week_n,
        },
        "devices": {"total": len(devs), "online": sum(1 for d in devs if d["status"] == "ONLINE")},
        "settlement": {
            "held": held,
            "last_paid": last_paid,
        },
        "open_help_requests": open_requests,
        "alerts": alerts,
    }


_ACTION_EVENT = {
    "remote_fix": ("Remote restart attempted", "device"),
    "repair_device": ("Device re-paired", "device"),
    "replace_device": ("Replacement ordered", "device"),
    "reverse_rent": ("Rent reversed", "money"),
    "refund_bill": ("Bill payment refunded", "money"),
    "release_settlement_hold": ("Settlement hold released", "money"),
    "request_document": ("Document requested", "kyc"),
}


def history(session: Session, merchant: Merchant, limit: int = 40) -> list[dict[str, Any]]:
    """One timeline of everything that happened on the account, newest first."""
    events: list[dict[str, Any]] = []
    for c in session.scalars(select(Case).where(Case.merchant_id == merchant.id)):
        events.append(
            {
                "ts": _utc(c.created_at),
                "kind": "case",
                "title": f"Asked for help: {c.summary}",
                "detail": f"Request #{c.id}",
                "status": "OPEN",
            }
        )
        if c.resolved_at:
            events.append(
                {
                    "ts": _utc(c.resolved_at),
                    "kind": "case",
                    "title": f"Request #{c.id} {c.status.lower()}",
                    "detail": c.summary,
                    "status": c.status,
                }
            )
    rows = session.execute(
        select(ActionRecord, Case)
        .join(Case, Case.id == ActionRecord.case_id)
        .where(Case.merchant_id == merchant.id)
    )
    for a, c in rows:
        title, kind = _ACTION_EVENT.get(a.name, (a.name.replace("_", " ").title(), "action"))
        ok = a.status == "DONE"
        events.append(
            {
                "ts": _utc(a.created_at),
                "kind": kind,
                "title": title if ok else f"{title}: did not work",
                "detail": a.reference or f"Request #{c.id}",
                "status": "SUCCESS" if ok and a.proved is not False else "FAILED",
            }
        )
    for st in session.scalars(select(Settlement).where(Settlement.merchant_id == merchant.id)):
        label = {
            "PAID": "Settled to bank",
            "HELD": "Settlement put on hold",
            "RELEASED": "Settlement released",
        }[st.status]
        events.append(
            {
                "ts": _utc(st.created_at),
                "kind": "money",
                "title": label,
                "detail": f"₹{st.amount_inr:,.0f}",
                "status": st.status,
            }
        )
    events.append(
        {
            "ts": _utc(merchant.member_since),
            "kind": "account",
            "title": "Joined",
            "detail": merchant.name,
            "status": "SUCCESS",
        }
    )
    events.sort(key=lambda e: e["ts"], reverse=True)
    return events[:limit]


def _location(merchant: Merchant, devs: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Simulated coordinates: the shop, a pin per device, and the nearest cell site."""
    lat, lng = merchant.lat, merchant.lng
    if lat is None or lng is None:
        return None
    return {
        "source": "simulated location",
        "shop": {"lat": lat, "lng": lng, "label": merchant.address or merchant.name},
        "devices": [
            {
                "id": d["id"],
                "kind": d["kind"],
                "serial": d["serial"],
                "status": d["status"],
                "lat": lat + 0.00025 * (i + 1),
                "lng": lng + 0.00025 * (i + 1),
            }
            for i, d in enumerate(devs)
        ],
        "tower": {
            "lat": lat + 0.0042,
            "lng": lng - 0.0031,
            "label": "Nearest cell site (simulated)",
        },
    }


def profile(session: Session, merchant: Merchant, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    devs = devices(session, merchant.id, now)
    lifetime = session.execute(
        select(func.coalesce(func.sum(Collection.amount_inr), 0), func.count()).where(
            Collection.merchant_id == merchant.id
        )
    ).one()
    cases = list(session.scalars(select(Case).where(Case.merchant_id == merchant.id)))
    return {
        "merchant": {
            "id": merchant.id,
            "name": merchant.name,
            "email": merchant.email,
            "category": merchant.category,
            "city": merchant.city,
            "address": merchant.address,
            "language": merchant.language,
            "kyc_status": merchant.kyc_status,
            "member_since": _utc(merchant.member_since),
        },
        "stats": {
            "collections_inr": Decimal(lifetime[0]),
            "collections_count": int(lifetime[1]),
            "devices": len(devs),
            "requests": len(cases),
            "resolved": sum(1 for c in cases if c.status == CaseStatus.RESOLVED.value),
            "solved_by_saathi": sum(
                1
                for c in cases
                if c.status == CaseStatus.RESOLVED.value and not c.handled_by_person
            ),
        },
        "location": _location(merchant, devs),
        "devices": devs,
        "history": history(session, merchant),
    }
