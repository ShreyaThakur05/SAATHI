from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from decimal import Decimal
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Approval, Case, Merchant
from app.domain.types import CaseStatus, Intent, StepKind, StepStatus
from app.rules.engine import CaseFacts, Outcome, ProposedAction, RuleDecision, evaluate
from app.services.connectors import Connectors
from app.services.recorder import CaseRecorder, to_json
from app.services.replies import Language, Reply
from app.skillpacks.models import SkillPack

REPEAT_WINDOW_DAYS = 30


@dataclass
class Ctx:
    session: Session
    case: Case
    pack: SkillPack
    conn: Connectors
    rec: CaseRecorder

    @property
    def language(self) -> Language:
        return self.case.language  # type: ignore[return-value]

    def facts(self, connector_prior_claims: int = 0, records_match: bool = True) -> CaseFacts:
        merchant = self.session.get(Merchant, self.case.merchant_id)
        since = datetime.now(UTC) - timedelta(days=REPEAT_WINDOW_DAYS)
        history = (
            self.session.scalar(
                select(func.count())
                .select_from(Case)
                .where(
                    Case.merchant_id == self.case.merchant_id,
                    Case.intent == self.case.intent,
                    Case.id != self.case.id,
                    Case.created_at >= since,
                    Case.status.in_(
                        [CaseStatus.RESOLVED, CaseStatus.AWAITING_APPROVAL, CaseStatus.REJECTED]
                    ),
                )
            )
            or 0
        )
        return CaseFacts(
            fraud_flag=bool(merchant and merchant.fraud_flag),
            prior_claims=max(history, connector_prior_claims),
            legal_mention=self.case.legal_mention,
            records_match=records_match,
            injection_suspected=self.case.injection_suspected,
        )

    def decide(self, action: str, facts: CaseFacts, amount: Decimal | None = None) -> RuleDecision:
        decision = evaluate(self.pack, ProposedAction(action, amount), facts)
        status = {
            Outcome.ALLOW: StepStatus.OK,
            Outcome.HAND_OFF: StepStatus.INFO,
            Outcome.BLOCK: StepStatus.FAILED,
        }[decision.outcome]
        self.rec.step(
            StepKind.DECIDE,
            status,
            f"Rules: {decision.outcome.value} {action}",
            rule_id=decision.rule_id,
            reason=decision.reason,
            pack=f"{decision.pack}@v{decision.pack_version}",
            amount_inr=amount,
        )
        return decision

    def finish(self, status: CaseStatus, reply: Reply, actor: str = "system:saathi") -> Reply:
        self.rec.transition(status, actor=actor)
        return reply

    def hand_off(
        self,
        decision: RuleDecision,
        action: str,
        evidence: dict[str, Any],
        amount: Decimal | None = None,
        params: dict[str, Any] | None = None,
        reply_key: str = "handoff",
    ) -> Reply:
        """Create a pre-built approval for a person and park the case."""
        self.session.add(
            Approval(
                case_id=self.case.id,
                action=action,
                amount_inr=amount,
                params=to_json(params or {}),
                rule_id=decision.rule_id,
                reason=decision.reason,
                evidence=to_json(evidence),
            )
        )
        self.rec.step(
            StepKind.HANDOFF,
            StepStatus.INFO,
            f"Handed to a person: {decision.reason}",
            rule_id=decision.rule_id,
            action=action,
        )
        self.rec.transition(CaseStatus.AWAITING_APPROVAL)
        return Reply(reply_key)

    def manual_review(
        self, rule_id: str, reason: str, evidence: dict[str, Any], reply_key: str = "handoff"
    ) -> Reply:
        decision = RuleDecision(
            Outcome.HAND_OFF, rule_id, reason, self.pack.skill_pack, self.pack.version
        )
        return self.hand_off(decision, "manual_review", evidence, reply_key=reply_key)


def lookup_step(ctx: Ctx, title: str, system: str, **detail: Any) -> None:
    ctx.rec.step(StepKind.LOOKUP, StepStatus.OK, title, system=f"{system} (simulated)", **detail)


def is_roadmap_intent(intent: str) -> bool:
    return intent in {Intent.UPI_ISSUE, Intent.LOAN_QUERY, Intent.UNSUPPORTED}
