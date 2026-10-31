"""SIMULATED Paytm back-office systems, backed by Postgres tables.

Not real Paytm integrations. They keep real state so that Saathi's Prove step re-reads
genuine system state instead of trusting its own earlier output.
"""

from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.connectors.base import (
    ActionResult,
    BillInfo,
    ConnectorError,
    DeviceStatus,
    FixResult,
    KycDocumentInfo,
    NotFoundError,
    RefundResult,
    RentalInfo,
    ReplacementOrderInfo,
    SettlementInfo,
)
from app.db.models import (
    BillPayment,
    Device,
    KycDocument,
    Rental,
    RentReversal,
    ReplacementOrder,
    Settlement,
    SimulatedRefund,
)

Clock = Callable[[], datetime]


def utcnow() -> datetime:
    return datetime.now(UTC)


class _Sim:
    def __init__(self, session: Session, clock: Clock = utcnow) -> None:
        self._s = session
        self._now = clock


class SimulatedDeviceClient(_Sim):
    def _device(self, device_id: int) -> Device:
        device = self._s.get(Device, device_id)
        if device is None:
            raise NotFoundError(f"device {device_id} not found")
        return device

    def find_device(self, merchant_id: int, kind: str) -> DeviceStatus | None:
        d = self._s.scalars(
            select(Device).where(Device.merchant_id == merchant_id, Device.kind == kind)
        ).first()
        return self.get_status(d.id) if d else None

    def get_status(self, device_id: int) -> DeviceStatus:
        d = self._device(device_id)
        offline_hours = 0
        if d.status == "OFFLINE":
            offline_hours = int((self._now() - d.last_seen_at).total_seconds() // 3600)
        return DeviceStatus(
            device_id=d.id,
            kind=d.kind,
            status=d.status,
            offline_hours=offline_hours,
            sim_signal=d.sim_signal,
            pairing_ok=d.pairing_ok,
        )

    def remote_fix(self, device_id: int) -> FixResult:
        d = self._device(device_id)
        if not d.fixable_remotely:
            return FixResult(success=False, detail="no heartbeat after remote restart")
        d.status, d.sim_signal, d.last_seen_at = "ONLINE", "GOOD", self._now()
        self._s.commit()
        return FixResult(success=True, detail="device restarted and online")

    def repair(self, device_id: int) -> FixResult:
        d = self._device(device_id)
        if not d.fixable_remotely:
            return FixResult(success=False, detail="pairing handshake failed")
        d.pairing_ok, d.status, d.last_seen_at = True, "ONLINE", self._now()
        self._s.commit()
        return FixResult(success=True, detail="re-paired")


class SimulatedBillingClient(_Sim):
    def get_rental(self, device_id: int) -> RentalInfo:
        rental = self._s.scalars(select(Rental).where(Rental.device_id == device_id)).first()
        if rental is None:
            raise NotFoundError(f"no rental for device {device_id}")
        prior = self._s.scalar(
            select(func.count())
            .select_from(RentReversal)
            .where(RentReversal.rental_id == rental.id)
        )
        return RentalInfo(
            rental_id=rental.id,
            monthly_rent_inr=rental.monthly_rent_inr,
            status=rental.status,
            prior_reversal_count=prior or 0,
        )

    def reverse_rent(
        self, rental_id: int, amount_inr: Decimal, idempotency_key: str
    ) -> ActionResult:
        existing = self._s.scalars(
            select(RentReversal).where(RentReversal.idempotency_key == idempotency_key)
        ).first()
        if existing:
            return ActionResult(reference=existing.reference, status=existing.status)
        rental = self._s.get(Rental, rental_id)
        if rental is None:
            raise NotFoundError(f"rental {rental_id} not found")
        if amount_inr <= 0 or amount_inr > rental.monthly_rent_inr:
            raise ConnectorError("reversal amount outside valid range")
        row = RentReversal(
            reference="pending",
            rental_id=rental_id,
            amount_inr=amount_inr,
            idempotency_key=idempotency_key,
        )
        self._s.add(row)
        self._s.flush()
        row.reference = f"RV-{20930 + row.id}"
        self._s.commit()
        return ActionResult(reference=row.reference, status=row.status)

    def get_reversal(self, reference: str) -> ActionResult:
        row = self._s.scalars(
            select(RentReversal).where(RentReversal.reference == reference)
        ).first()
        if row is None:
            raise NotFoundError(f"reversal {reference} not found")
        return ActionResult(reference=row.reference, status=row.status)


class SimulatedLogisticsClient(_Sim):
    ETA_DAYS = 3

    def create_replacement(self, device_id: int, idempotency_key: str) -> ActionResult:
        existing = self._s.scalars(
            select(ReplacementOrder).where(ReplacementOrder.idempotency_key == idempotency_key)
        ).first()
        if existing:
            return ActionResult(reference=existing.reference, status=existing.status)
        if self._s.get(Device, device_id) is None:
            raise NotFoundError(f"device {device_id} not found")
        order = ReplacementOrder(
            reference="pending",
            device_id=device_id,
            eta_date=self._now() + timedelta(days=self.ETA_DAYS),
            idempotency_key=idempotency_key,
        )
        self._s.add(order)
        self._s.flush()
        order.reference = f"RPL-{4470 + order.id}"
        self._s.commit()
        return ActionResult(reference=order.reference, status=order.status)

    def get_order(self, reference: str) -> ReplacementOrderInfo:
        order = self._s.scalars(
            select(ReplacementOrder).where(ReplacementOrder.reference == reference)
        ).first()
        if order is None:
            raise NotFoundError(f"order {reference} not found")
        return ReplacementOrderInfo(
            reference=order.reference, status=order.status, eta_date=order.eta_date
        )


class SimulatedSettlementClient(_Sim):
    def get_held_settlement(self, merchant_id: int) -> SettlementInfo | None:
        s = self._s.scalars(
            select(Settlement).where(
                Settlement.merchant_id == merchant_id, Settlement.status == "HELD"
            )
        ).first()
        if s is None:
            return None
        return SettlementInfo(
            settlement_id=s.id,
            amount_inr=s.amount_inr,
            status=s.status,
            hold_reason=s.hold_reason,
        )

    def get_kyc_documents(self, merchant_id: int) -> list[KycDocumentInfo]:
        rows = self._s.scalars(
            select(KycDocument).where(KycDocument.merchant_id == merchant_id)
        ).all()
        return [KycDocumentInfo(doc_type=r.doc_type, status=r.status) for r in rows]

    def submit_document(self, merchant_id: int, doc_type: str) -> KycDocumentInfo:
        """SIMULATED document check: a submitted document is marked VERIFIED."""
        doc = self._s.scalars(
            select(KycDocument).where(
                KycDocument.merchant_id == merchant_id, KycDocument.doc_type == doc_type
            )
        ).first()
        if doc is None:
            raise NotFoundError(f"no {doc_type} requirement for merchant {merchant_id}")
        doc.status = "VERIFIED"
        self._s.commit()
        return KycDocumentInfo(doc_type=doc.doc_type, status=doc.status)

    def release_hold(self, merchant_id: int, idempotency_key: str) -> ActionResult:
        held = self._s.scalars(
            select(Settlement).where(
                Settlement.merchant_id == merchant_id, Settlement.status == "HELD"
            )
        ).first()
        if held is None:  # already released: idempotent
            return ActionResult(reference=f"REL-{idempotency_key[-8:]}", status="RELEASED")
        held.status, held.hold_reason = "RELEASED", None
        self._s.commit()
        return ActionResult(reference=f"REL-{held.id:05d}", status="RELEASED")


class SimulatedBillerClient(_Sim):
    def get_bill(self, gateway_txn_id: str) -> BillInfo:
        bill = self._s.scalars(
            select(BillPayment).where(BillPayment.gateway_txn_id == gateway_txn_id)
        ).first()
        if bill is None:
            raise NotFoundError(f"transaction {gateway_txn_id} not found")
        return self._info(bill)

    def list_bills(self, merchant_id: int) -> list[BillInfo]:
        rows = self._s.scalars(
            select(BillPayment)
            .where(BillPayment.merchant_id == merchant_id)
            .order_by(BillPayment.paid_at.desc())
        ).all()
        return [self._info(b) for b in rows]

    @staticmethod
    def _info(bill: BillPayment) -> BillInfo:
        return BillInfo(
            gateway_txn_id=bill.gateway_txn_id,
            biller=bill.biller,
            amount_inr=bill.amount_inr,
            debited=bill.debited,
            biller_status=bill.biller_status,
            paid_at=bill.paid_at,
        )


class SimulatedPaymentGateway(_Sim):
    """Simulated Paytm PG refund API: initiate -> PENDING -> SUCCESS (or FAILURE).

    `success_after_polls` controls how many status checks return PENDING before SUCCESS,
    so the Prove step genuinely has to poll. Transactions in `failing_txn_ids` end in FAILURE.
    """

    def __init__(
        self,
        session: Session,
        clock: Clock = utcnow,
        success_after_polls: int = 1,
        failing_txn_ids: frozenset[str] = frozenset(),
    ) -> None:
        super().__init__(session, clock)
        self._success_after = success_after_polls
        self._failing = failing_txn_ids

    def initiate_refund(
        self, refund_id: str, gateway_txn_id: str, amount_inr: Decimal
    ) -> RefundResult:
        existing = self._s.scalars(
            select(SimulatedRefund).where(SimulatedRefund.refund_id == refund_id)
        ).first()
        if existing:
            if existing.amount_inr != amount_inr or existing.gateway_txn_id != gateway_txn_id:
                raise ConnectorError("refund_id reused with different parameters")
            return self._result(existing)
        bill = self._s.scalars(
            select(BillPayment).where(BillPayment.gateway_txn_id == gateway_txn_id)
        ).first()
        if bill is None:
            raise NotFoundError(f"transaction {gateway_txn_id} not found")
        already = self._s.scalar(
            select(func.coalesce(func.sum(SimulatedRefund.amount_inr), 0)).where(
                SimulatedRefund.gateway_txn_id == gateway_txn_id,
                SimulatedRefund.status != "FAILURE",
            )
        )
        if amount_inr <= 0 or (already or Decimal(0)) + amount_inr > bill.amount_inr:
            raise ConnectorError("refund amount exceeds refundable balance")
        row = SimulatedRefund(
            refund_id=refund_id, gateway_txn_id=gateway_txn_id, amount_inr=amount_inr
        )
        self._s.add(row)
        self._s.commit()
        return self._result(row)

    def get_refund_status(self, refund_id: str) -> RefundResult:
        row = self._s.scalars(
            select(SimulatedRefund).where(SimulatedRefund.refund_id == refund_id)
        ).first()
        if row is None:
            raise NotFoundError(f"refund {refund_id} not found")
        if row.status == "PENDING":
            row.status_polls += 1
            if row.status_polls >= self._success_after:
                row.status = "FAILURE" if row.gateway_txn_id in self._failing else "SUCCESS"
            self._s.commit()
        return self._result(row)

    @staticmethod
    def _result(row: SimulatedRefund) -> RefundResult:
        return RefundResult(refund_id=row.refund_id, status=row.status, amount_inr=row.amount_inr)
