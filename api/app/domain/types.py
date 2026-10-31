from enum import StrEnum


class Product(StrEnum):
    SOUNDBOX = "SOUNDBOX"
    CARD_MACHINE = "CARD_MACHINE"
    SETTLEMENT_KYC = "SETTLEMENT_KYC"
    BILL_PAYMENT = "BILL_PAYMENT"
    UPI = "UPI"
    LOANS = "LOANS"
    UNKNOWN = "UNKNOWN"


class Intent(StrEnum):
    DEVICE_FAULT = "device_fault"
    RENT_DISPUTE = "rent_dispute"
    CARD_MACHINE_ISSUE = "card_machine_issue"
    SETTLEMENT_HELD = "settlement_held"
    BILL_PAYMENT_FAILED = "bill_payment_failed"
    UPI_ISSUE = "upi_issue"
    LOAN_QUERY = "loan_query"
    UNSUPPORTED = "unsupported"


class CaseStatus(StrEnum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    WAITING_MERCHANT = "WAITING_MERCHANT"
    AWAITING_APPROVAL = "AWAITING_APPROVAL"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"  # a person declined the request
    BLOCKED = "BLOCKED"  # rules refused (never-do, untrusted instruction)
    FAILED = "FAILED"  # proof failed and no fallback; needs a person


TERMINAL_STATUSES = frozenset(
    {CaseStatus.RESOLVED, CaseStatus.REJECTED, CaseStatus.BLOCKED, CaseStatus.FAILED}
)

ALLOWED_TRANSITIONS: dict[CaseStatus, frozenset[CaseStatus]] = {
    CaseStatus.OPEN: frozenset({CaseStatus.IN_PROGRESS, CaseStatus.BLOCKED}),
    CaseStatus.IN_PROGRESS: frozenset(
        {
            CaseStatus.WAITING_MERCHANT,
            CaseStatus.AWAITING_APPROVAL,
            CaseStatus.RESOLVED,
            CaseStatus.BLOCKED,
            CaseStatus.FAILED,
        }
    ),
    CaseStatus.WAITING_MERCHANT: frozenset({CaseStatus.IN_PROGRESS, CaseStatus.FAILED}),
    CaseStatus.AWAITING_APPROVAL: frozenset(
        {CaseStatus.IN_PROGRESS, CaseStatus.RESOLVED, CaseStatus.REJECTED, CaseStatus.FAILED}
    ),
    CaseStatus.RESOLVED: frozenset(),
    CaseStatus.REJECTED: frozenset(),
    CaseStatus.BLOCKED: frozenset(),
    CaseStatus.FAILED: frozenset(),
}


class StepKind(StrEnum):
    LISTEN = "LISTEN"
    UNDERSTAND = "UNDERSTAND"
    LOOKUP = "LOOKUP"
    DECIDE = "DECIDE"
    ACT = "ACT"
    PROVE = "PROVE"
    HANDOFF = "HANDOFF"
    REPLY = "REPLY"


class StepStatus(StrEnum):
    OK = "OK"
    FAILED = "FAILED"
    INFO = "INFO"
