from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.domain.types import Intent, Product


class PackStatus(StrEnum):
    LIVE = "live"
    ROADMAP = "roadmap"


class HandOffCondition(StrEnum):
    FRAUD_FLAG = "fraud_flag"
    REPEAT_CLAIM = "repeat_claim"
    LEGAL_MENTION = "legal_mention"
    RECORDS_MISMATCH = "records_mismatch"


class SkillPack(BaseModel):
    """One product's problems, allowed actions, rupee limits, proof checks and hand-offs."""

    model_config = ConfigDict(frozen=True)

    skill_pack: str
    version: int = Field(ge=1)
    product: Product
    status: PackStatus
    title: str
    intents: list[Intent]
    allowed_actions: list[str] = []
    action_limits_inr: dict[str, Decimal] = {}
    requires_person: list[str] = []  # actions that always need an approver
    max_prior_claims: int = 0  # more prior claims than this => repeat claim => hand off
    hand_off_if: list[HandOffCondition] = []
    proof: dict[str, str] = {}  # action -> human-readable proof check
    params: dict[str, Decimal | int | str] = {}

    @model_validator(mode="after")
    def _live_packs_need_actions(self) -> "SkillPack":
        if self.status is PackStatus.LIVE and not self.allowed_actions:
            raise ValueError(f"live pack {self.skill_pack} must declare allowed_actions")
        unknown = set(self.action_limits_inr) - set(self.allowed_actions)
        if unknown:
            raise ValueError(f"limits for undeclared actions: {sorted(unknown)}")
        missing_proof = set(self.allowed_actions) - set(self.proof)
        if self.status is PackStatus.LIVE and missing_proof:
            raise ValueError(f"actions without a proof check: {sorted(missing_proof)}")
        return self
