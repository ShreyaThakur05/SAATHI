"""Deterministic rules engine: the only component that may authorise an action.

The LLM never reaches this decision. It supplies an intent label; facts come from
system lookups; limits and hand-off conditions come from the Skill Pack.
"""

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum

from app.skillpacks.models import HandOffCondition, SkillPack

# Things Saathi must never do, whatever any pack or message says.
NEVER_ACTIONS = frozenset(
    {
        "request_pin",
        "request_otp",
        "request_card_number",
        "promise_settlement_date",
        "change_loan_terms",
        "change_fee_terms",
    }
)


class Outcome(StrEnum):
    ALLOW = "ALLOW"
    HAND_OFF = "HAND_OFF"
    BLOCK = "BLOCK"


@dataclass(frozen=True)
class ProposedAction:
    name: str
    amount_inr: Decimal | None = None


@dataclass(frozen=True)
class CaseFacts:
    fraud_flag: bool = False
    prior_claims: int = 0
    legal_mention: bool = False
    records_match: bool = True
    injection_suspected: bool = False


@dataclass(frozen=True)
class RuleDecision:
    outcome: Outcome
    rule_id: str
    reason: str
    pack: str
    pack_version: int


def evaluate(pack: SkillPack, action: ProposedAction, facts: CaseFacts) -> RuleDecision:
    def decide(outcome: Outcome, rule_id: str, reason: str) -> RuleDecision:
        return RuleDecision(outcome, rule_id, reason, pack.skill_pack, pack.version)

    if action.name in NEVER_ACTIONS:
        return decide(Outcome.BLOCK, "never_do", f"'{action.name}' is never done by Saathi")
    if facts.injection_suspected:
        return decide(
            Outcome.BLOCK, "untrusted_instruction", "message contains instructions, not a claim"
        )
    if action.name not in pack.allowed_actions:
        return decide(Outcome.BLOCK, "not_in_skill_pack", f"{action.name} not allowed by pack")

    conditions = set(pack.hand_off_if)
    if HandOffCondition.FRAUD_FLAG in conditions and facts.fraud_flag:
        return decide(Outcome.HAND_OFF, "fraud_flag", "fraud flag on the account")
    if HandOffCondition.LEGAL_MENTION in conditions and facts.legal_mention:
        return decide(Outcome.HAND_OFF, "legal_mention", "legal action or regulator mentioned")
    if HandOffCondition.RECORDS_MISMATCH in conditions and not facts.records_match:
        return decide(Outcome.HAND_OFF, "records_mismatch", "system records do not match")
    if HandOffCondition.REPEAT_CLAIM in conditions and facts.prior_claims > pack.max_prior_claims:
        return decide(Outcome.HAND_OFF, "repeat_claim", "repeat claim needs a person")

    limit = pack.action_limits_inr.get(action.name)
    if limit is not None and action.amount_inr is not None and action.amount_inr > limit:
        return decide(
            Outcome.HAND_OFF,
            "amount_over_limit",
            f"amount {action.amount_inr} exceeds auto limit {limit}",
        )
    if action.name in pack.requires_person:
        return decide(Outcome.HAND_OFF, "requires_person", f"{action.name} needs a person")
    return decide(Outcome.ALLOW, "allowed", "within skill pack limits")
