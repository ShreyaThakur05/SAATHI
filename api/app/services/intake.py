from dataclasses import dataclass
from decimal import Decimal

from sqlalchemy.orm import Session

from app.ai.pii import mask
from app.ai.schemas import ParsedCase, Understanding
from app.ai.understand import understand
from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import Case, Conversation, Merchant, Message
from app.domain.types import Intent, Product, StepKind, StepStatus
from app.services.messaging import post_saathi
from app.services.recorder import CaseRecorder
from app.services.replies import Reply, ack_text, render
from app.skillpacks.loader import SkillPackRegistry

MAX_MESSAGE_CHARS = 1000
PRIORITY = [
    Intent.DEVICE_FAULT,
    Intent.CARD_MACHINE_ISSUE,
    Intent.RENT_DISPUTE,
    Intent.SETTLEMENT_HELD,
    Intent.BILL_PAYMENT_FAILED,
    Intent.UPI_ISSUE,
    Intent.LOAN_QUERY,
    Intent.UNSUPPORTED,
]


@dataclass(frozen=True)
class IntakeResult:
    conversation_id: int
    message_id: int
    case_ids: list[int]


def _dedupe_sorted(parsed: list[ParsedCase]) -> list[ParsedCase]:
    unique: dict[tuple[Intent, bool], ParsedCase] = {}
    for p in parsed:
        unique.setdefault((p.intent, p.injection_suspected), p)
    return sorted(unique.values(), key=lambda p: PRIORITY.index(p.intent))


def intake_message(
    session: Session,
    registry: SkillPackRegistry,
    settings: Settings,
    merchant_id: int,
    text: str,
    input_mode: str = "text",
    conversation_id: int | None = None,
) -> IntakeResult:
    text = text.strip()
    if not 1 <= len(text) <= MAX_MESSAGE_CHARS:
        raise AppError("invalid_message", f"Message must be 1-{MAX_MESSAGE_CHARS} characters", 422)
    if session.get(Merchant, merchant_id) is None:
        raise AppError("unknown_merchant", "Merchant not found", 404)

    if conversation_id is None:
        convo = Conversation(merchant_id=merchant_id)
        session.add(convo)
        session.flush()
    else:
        convo = session.get(Conversation, conversation_id)  # type: ignore[assignment]
        if convo is None or convo.merchant_id != merchant_id:
            raise AppError("unknown_conversation", "Conversation not found", 404)

    masked, sensitive = mask(text)
    message = Message(conversation_id=convo.id, role="MERCHANT", text=masked, input_mode=input_mode)
    session.add(message)
    session.commit()

    result: Understanding = understand(text, settings)
    parsed = _dedupe_sorted(result.cases)
    lang = result.language

    if sensitive or result.sensitive_shared:
        post_saathi(session, convo.id, render(Reply("sensitive_warning"), lang))
    if not parsed:
        post_saathi(session, convo.id, render(Reply("unclear"), lang))
        return IntakeResult(convo.id, message.id, [])

    per_case_cost = result.ai_cost_inr / len(parsed)
    case_ids: list[int] = []
    for p in parsed:
        pack = registry.for_intent(p.intent)
        case = Case(
            conversation_id=convo.id,
            merchant_id=merchant_id,
            product=(pack.product if pack else Product.UNKNOWN).value,
            intent=p.intent.value,
            language=lang,
            summary=p.summary,
            claimed_amount_inr=p.claimed_amount_inr,
            injection_suspected=p.injection_suspected,
            legal_mention=result.legal_mention,
            understanding_mode=result.mode,
            ai_cost_inr=per_case_cost.quantize(Decimal("0.0001")),
        )
        session.add(case)
        session.flush()
        rec = CaseRecorder(session, case)
        rec.audit("case.created", actor=f"merchant:{merchant_id}", intent=case.intent)
        rec.step(
            StepKind.LISTEN,
            StepStatus.OK,
            f"Heard {input_mode} message in {lang}",
            text=masked,
            input_mode=input_mode,
        )
        rec.step(
            StepKind.UNDERSTAND,
            StepStatus.OK,
            f"Understood: {case.intent.replace('_', ' ')}"
            + (f" (1 of {len(parsed)} cases)" if len(parsed) > 1 else ""),
            mode=result.mode,
            confidence=result.confidence,
            injection_suspected=case.injection_suspected,
            ai_cost_inr=case.ai_cost_inr,
        )
        case_ids.append(case.id)

    post_saathi(session, convo.id, ack_text([p.intent.value for p in parsed], lang))
    return IntakeResult(convo.id, message.id, case_ids)
