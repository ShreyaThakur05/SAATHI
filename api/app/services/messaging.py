from typing import Any

from sqlalchemy.orm import Session

from app.db.models import Message
from app.domain.types import CaseStatus
from app.services.replies import Language, Reply, ack_text, render


def replies_render(replies: list[Reply]) -> dict[str, Any]:
    return {"kind": "replies", "items": [{"key": r.key, "refs": r.refs} for r in replies]}


def ack_render(intents: list[str]) -> dict[str, Any]:
    return {"kind": "ack", "intents": intents}


def render_in(spec: dict[str, Any] | None, language: Language, fallback: str) -> str:
    """Render a stored message spec in `language`; messages without a spec keep their text."""
    if not spec:
        return fallback
    if spec.get("kind") == "ack":
        return ack_text(list(spec["intents"]), language)
    if spec.get("kind") == "replies":
        seen: list[str] = []
        for item in spec["items"]:
            text = render(Reply(item["key"], dict(item.get("refs") or {})), language)
            if text not in seen:  # several cases may end in the same generic hand-off text
                seen.append(text)
        return "\n\n".join(seen)
    return fallback


def post_saathi(
    session: Session,
    conversation_id: int,
    text: str,
    card: dict[str, Any] | None = None,
    case_id: int | None = None,
    spec: dict[str, Any] | None = None,
) -> Message:
    msg = Message(
        conversation_id=conversation_id,
        role="SAATHI",
        text=text,
        card=card,
        case_id=case_id,
        render=spec,
    )
    session.add(msg)
    session.commit()
    return msg


def card_for(
    results: list[tuple[int, CaseStatus, Reply]], uploads: list[dict[str, Any]] | None = None
) -> dict[str, Any]:
    statuses = {s for _, s, _ in results}
    if CaseStatus.AWAITING_APPROVAL in statuses or CaseStatus.FAILED in statuses:
        state = "escalated"
    elif CaseStatus.WAITING_MERCHANT in statuses:
        state = "waiting"
    elif CaseStatus.BLOCKED in statuses or CaseStatus.REJECTED in statuses:
        state = "blocked"
    else:
        state = "resolved"
    return {
        "state": state,
        "case_ids": [cid for cid, _, _ in results],
        "uploads": uploads or [],  # documents the merchant is asked for: {case_id, doc_type}
        "items": [
            {"label": i.label, "ref": i.ref, "note": i.note}
            for _, _, reply in results
            for i in reply.items
        ],
    }


def compose(results: list[tuple[int, CaseStatus, Reply]], language: Language) -> str:
    seen: list[str] = []
    for _, _, reply in results:
        text = render(reply, language)
        if text not in seen:  # several cases may end in the same generic hand-off text
            seen.append(text)
    return "\n\n".join(seen)
