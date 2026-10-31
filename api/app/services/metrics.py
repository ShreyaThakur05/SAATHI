from collections import Counter
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from statistics import median
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.db.models import ActionRecord, Case
from app.domain.types import CaseStatus

# Illustrative inputs from the pitch; the UI labels anything derived from them as such.
HUMAN_COST_PER_TICKET_INR = Decimal("40")


def compute_metrics(session: Session, settings: Settings) -> dict[str, Any]:
    cases = list(session.scalars(select(Case)))
    actions = list(session.scalars(select(ActionRecord)))
    now = datetime.now(UTC)
    total = len(cases)
    resolved = [c for c in cases if c.status == CaseStatus.RESOLVED.value]
    auto = [c for c in resolved if not c.handled_by_person]
    durations = [(c.resolved_at - c.created_at).total_seconds() for c in auto if c.resolved_at]
    # An attempt counts whether or not it worked; actions whose proof is deferred do not yet.
    attempted = [a for a in actions if a.proved is not None or a.status == "FAILED"]
    proved = [a for a in attempted if a.proved]

    repeat = 0
    for c in resolved:
        if c.resolved_at and any(
            o.id != c.id
            and o.merchant_id == c.merchant_id
            and o.product == c.product
            and c.resolved_at <= o.created_at <= c.resolved_at + timedelta(days=7)
            for o in cases
        ):
            repeat += 1

    deadline_cases = [c for c in cases if c.refund_deadline_at is not None]
    open_deadline = [c for c in deadline_cases if c.status not in {CaseStatus.RESOLVED.value}]
    ai_cost = sum((c.ai_cost_inr for c in cases), Decimal("0"))
    by_product: Counter[str] = Counter(c.product for c in cases)
    modes: Counter[str] = Counter(c.understanding_mode for c in cases)
    cost_per_resolved = (ai_cost / len(resolved)) if resolved else None
    savings = (
        len(auto) * (HUMAN_COST_PER_TICKET_INR - (cost_per_resolved or Decimal("0")))
        if auto
        else Decimal("0")
    )
    return {
        "cases_total": total,
        "by_status": dict(Counter(c.status for c in cases)),
        "by_product": dict(by_product),
        "solved_without_person": {"count": len(auto), "rate": _rate(len(auto), total)},
        "actions_confirmed_success": {
            "confirmed": len(proved),
            "attempted": len(attempted),
            "rate": _rate(len(proved), len(attempted)),
        },
        "median_time_to_resolve_s": median(durations) if durations else None,
        "ai_cost_per_resolved_ticket_inr": cost_per_resolved,
        "repeat_contact_within_7d": {"count": repeat, "rate": _rate(repeat, len(resolved))},
        "refunds": {
            "tracked": len(deadline_cases),
            "open": len(open_deadline),
            "past_deadline": sum(
                1 for c in open_deadline if c.refund_deadline_at and c.refund_deadline_at < now
            ),
        },
        "awaiting_person": sum(1 for c in cases if c.status == CaseStatus.AWAITING_APPROVAL.value),
        "understanding_modes": dict(modes),
        "illustrative": {
            "human_cost_per_ticket_inr": HUMAN_COST_PER_TICKET_INR,
            "estimated_saving_inr": savings,
            "note": "Illustrative: uses the pitch's Rs 40/ticket assumption times measured "
            "auto-resolved cases. Not a measured saving.",
        },
    }


def _rate(n: int, d: int) -> float | None:
    return round(n / d, 4) if d else None
