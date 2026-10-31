from datetime import UTC, datetime
from decimal import Decimal

import pytest
from sqlalchemy.orm import Session

from app.connectors.base import ConnectorError, NotFoundError
from app.connectors.simulated.systems import (
    SimulatedBillerClient,
    SimulatedBillingClient,
    SimulatedDeviceClient,
    SimulatedLogisticsClient,
    SimulatedPaymentGateway,
    SimulatedSettlementClient,
)
from app.seed.demo import seed_demo

NOW = datetime(2026, 10, 30, 12, 0, tzinfo=UTC)


@pytest.fixture
def ids(session: Session) -> dict[str, int]:
    return seed_demo(session, now=NOW)


def clock() -> datetime:
    return NOW


def test_seed_is_idempotent(session: Session, ids: dict[str, int]) -> None:
    assert ids
    assert seed_demo(session, now=NOW) == {}


def test_soundbox_reports_49_offline_hours(session: Session, ids: dict[str, int]) -> None:
    status = SimulatedDeviceClient(session, clock).get_status(ids["soundbox_device"])
    assert (status.status, status.offline_hours, status.sim_signal) == ("OFFLINE", 49, "WEAK")


def test_remote_fix_fails_on_hardware_fault_and_succeeds_when_fixable(
    session: Session, ids: dict[str, int]
) -> None:
    dev = SimulatedDeviceClient(session, clock)
    assert dev.remote_fix(ids["soundbox_device"]).success is False
    assert dev.get_status(ids["soundbox_device"]).status == "OFFLINE"  # unchanged

    assert dev.repair(ids["card_device"]).success is True
    status = dev.get_status(ids["card_device"])
    assert (status.status, status.pairing_ok) == ("ONLINE", True)


def test_unknown_device_raises_not_found(session: Session, ids: dict[str, int]) -> None:
    with pytest.raises(NotFoundError):
        SimulatedDeviceClient(session, clock).get_status(9999)


def test_rent_reversal_is_idempotent_and_verifiable(session: Session, ids: dict[str, int]) -> None:
    billing = SimulatedBillingClient(session, clock)
    rental = billing.get_rental(ids["soundbox_device"])
    assert rental.prior_reversal_count == 0

    first = billing.reverse_rent(rental.rental_id, Decimal("20"), "case-1:reverse_rent")
    again = billing.reverse_rent(rental.rental_id, Decimal("20"), "case-1:reverse_rent")
    assert first == again
    assert billing.get_rental(ids["soundbox_device"]).prior_reversal_count == 1
    assert billing.get_reversal(first.reference).status == "SUCCESS"


def test_rent_reversal_rejects_invalid_amounts(session: Session, ids: dict[str, int]) -> None:
    billing = SimulatedBillingClient(session, clock)
    rental = billing.get_rental(ids["soundbox_device"])
    for bad in (Decimal("0"), Decimal("-5"), Decimal("301")):
        with pytest.raises(ConnectorError):
            billing.reverse_rent(rental.rental_id, bad, f"k-{bad}")


def test_replacement_order_idempotent_and_found_in_logistics(
    session: Session, ids: dict[str, int]
) -> None:
    logistics = SimulatedLogisticsClient(session, clock)
    a = logistics.create_replacement(ids["soundbox_device"], "case-1:replace")
    b = logistics.create_replacement(ids["soundbox_device"], "case-1:replace")
    assert a == b and a.reference.startswith("RPL-")
    assert logistics.get_order(a.reference).status == "CREATED"


def test_settlement_hold_and_missing_kyc_document(session: Session, ids: dict[str, int]) -> None:
    client = SimulatedSettlementClient(session, clock)
    held = client.get_held_settlement(ids["settlement_merchant"])
    assert held is not None and held.hold_reason == "KYC_DOCUMENT_MISSING"
    missing = [
        d.doc_type
        for d in client.get_kyc_documents(ids["settlement_merchant"])
        if d.status == "MISSING"
    ]
    assert missing == ["GST"]
    assert client.get_held_settlement(ids["bill_merchant"]) is None


def test_refund_requires_polling_before_success(session: Session, ids: dict[str, int]) -> None:
    gw = SimulatedPaymentGateway(session, clock, success_after_polls=2)
    started = gw.initiate_refund("R-1", "TXN-BILL-1001", Decimal("1840"))
    assert started.status == "PENDING"
    assert gw.get_refund_status("R-1").status == "PENDING"
    assert gw.get_refund_status("R-1").status == "SUCCESS"


def test_refund_is_idempotent_and_guards_parameters(session: Session, ids: dict[str, int]) -> None:
    gw = SimulatedPaymentGateway(session, clock)
    assert gw.initiate_refund("R-1", "TXN-BILL-1001", Decimal("1840")) == gw.initiate_refund(
        "R-1", "TXN-BILL-1001", Decimal("1840")
    )
    with pytest.raises(ConnectorError):
        gw.initiate_refund("R-1", "TXN-BILL-1001", Decimal("10"))  # id reused, different amount


def test_refund_cannot_exceed_refundable_balance(session: Session, ids: dict[str, int]) -> None:
    gw = SimulatedPaymentGateway(session, clock)
    gw.initiate_refund("R-1", "TXN-BILL-1001", Decimal("1840"))
    with pytest.raises(ConnectorError):
        gw.initiate_refund("R-2", "TXN-BILL-1001", Decimal("1"))
    with pytest.raises(NotFoundError):
        gw.initiate_refund("R-3", "TXN-NOPE", Decimal("1"))


def test_gateway_failure_path(session: Session, ids: dict[str, int]) -> None:
    gw = SimulatedPaymentGateway(session, clock, failing_txn_ids=frozenset({"TXN-BILL-1001"}))
    gw.initiate_refund("R-1", "TXN-BILL-1001", Decimal("100"))
    assert gw.get_refund_status("R-1").status == "FAILURE"


def test_biller_status(session: Session, ids: dict[str, int]) -> None:
    biller = SimulatedBillerClient(session, clock)
    assert biller.get_bill("TXN-BILL-1001").biller_status == "FAILED"
    assert biller.get_bill("TXN-BILL-1002").biller_status == "SUCCESS"


def test_kyc_document_submission_and_hold_release_are_idempotent(
    session: Session, ids: dict[str, int]
) -> None:
    client = SimulatedSettlementClient(session, clock)
    mid = ids["settlement_merchant"]
    assert client.submit_document(mid, "GST").status == "VERIFIED"
    assert all(d.status == "VERIFIED" for d in client.get_kyc_documents(mid))
    first = client.release_hold(mid, "case-9:release")
    second = client.release_hold(mid, "case-9:release")
    assert first.status == second.status == "RELEASED"
    assert client.get_held_settlement(mid) is None
    with pytest.raises(NotFoundError):
        client.submit_document(mid, "NOT_A_DOC")
