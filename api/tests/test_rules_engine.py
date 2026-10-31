from decimal import Decimal

import pytest

from app.rules.engine import CaseFacts, Outcome, ProposedAction, evaluate
from app.skillpacks.loader import SkillPackRegistry, get_registry
from app.skillpacks.models import SkillPack

pack = get_registry().get("soundbox")
assert pack is not None


def run(name: str, amount: str | None = None, **facts: object):  # type: ignore[no-untyped-def]
    amt = Decimal(amount) if amount is not None else None
    return evaluate(pack, ProposedAction(name, amt), CaseFacts(**facts))  # type: ignore[arg-type]


@pytest.mark.parametrize(
    ("amount", "outcome"),
    [
        ("20", Outcome.ALLOW),
        ("499", Outcome.ALLOW),
        ("500", Outcome.ALLOW),
        ("500.01", Outcome.HAND_OFF),
        ("501", Outcome.HAND_OFF),
    ],
)
def test_rent_reversal_limit_boundary(amount: str, outcome: Outcome) -> None:
    decision = run("reverse_rent", amount)
    assert decision.outcome is outcome
    if outcome is Outcome.HAND_OFF:
        assert decision.rule_id == "amount_over_limit"


def test_repeat_claim_goes_to_a_person() -> None:
    assert run("reverse_rent", "20", prior_claims=0).outcome is Outcome.ALLOW
    d = run("reverse_rent", "20", prior_claims=1)
    assert (d.outcome, d.rule_id) == (Outcome.HAND_OFF, "repeat_claim")


@pytest.mark.parametrize(
    ("flag", "rule"),
    [
        ({"fraud_flag": True}, "fraud_flag"),
        ({"legal_mention": True}, "legal_mention"),
        ({"records_match": False}, "records_mismatch"),
    ],
)
def test_hand_off_conditions(flag: dict[str, bool], rule: str) -> None:
    d = run("remote_fix", **flag)
    assert (d.outcome, d.rule_id) == (Outcome.HAND_OFF, rule)


def test_untrusted_instruction_is_blocked_even_for_allowed_action() -> None:
    d = run("reverse_rent", "20", injection_suspected=True)
    assert (d.outcome, d.rule_id) == (Outcome.BLOCK, "untrusted_instruction")


@pytest.mark.parametrize(
    "name", ["request_pin", "request_otp", "promise_settlement_date", "change_loan_terms"]
)
def test_never_actions_blocked(name: str) -> None:
    assert run(name).outcome is Outcome.BLOCK


def test_action_outside_pack_is_blocked() -> None:
    assert run("refund_bill", "100").rule_id == "not_in_skill_pack"


def test_releasing_settlement_hold_always_needs_a_person() -> None:
    p = get_registry().get("settlement_kyc")
    assert p is not None
    d = evaluate(p, ProposedAction("release_settlement_hold"), CaseFacts())
    assert (d.outcome, d.rule_id) == (Outcome.HAND_OFF, "requires_person")


def test_packs_load_and_validate() -> None:
    reg = get_registry()
    assert {p.skill_pack for p in reg.live()} == {
        "soundbox",
        "card_machine",
        "settlement_kyc",
        "bill_payments",
    }
    assert {p.skill_pack for p in reg.all()} >= {"upi", "merchant_loans"}


def test_invalid_pack_rejected() -> None:
    with pytest.raises(ValueError, match="proof"):
        SkillPack.model_validate(
            {
                "skill_pack": "x",
                "version": 1,
                "product": "SOUNDBOX",
                "status": "live",
                "title": "x",
                "intents": ["device_fault"],
                "allowed_actions": ["remote_fix"],
            }
        )


def test_two_packs_cannot_claim_the_same_intent() -> None:
    base = {
        "version": 1,
        "status": "roadmap",
        "title": "x",
        "intents": ["upi_issue"],
        "product": "UPI",
    }
    packs = [SkillPack.model_validate({**base, "skill_pack": n}) for n in ("a", "b")]
    with pytest.raises(ValueError, match="claimed by two packs"):
        SkillPackRegistry(packs)
