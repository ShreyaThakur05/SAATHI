"""Connector contracts between Saathi's core and Paytm's back-office systems.

The core depends only on these Protocols. Today they are implemented by simulated
connectors (app/connectors/simulated); going live means providing implementations that
call Paytm's internal systems. Every mutating call takes an idempotency key so that a
retry can never perform the action twice.
"""

from datetime import datetime
from decimal import Decimal
from typing import Protocol

from pydantic import BaseModel, ConfigDict


class _Model(BaseModel):
    model_config = ConfigDict(frozen=True)


class ConnectorError(Exception):
    """A downstream system rejected or failed a call."""


class NotFoundError(ConnectorError):
    pass


class DeviceStatus(_Model):
    device_id: int
    kind: str
    status: str
    offline_hours: int
    sim_signal: str
    pairing_ok: bool


class FixResult(_Model):
    success: bool
    detail: str


class RentalInfo(_Model):
    rental_id: int
    monthly_rent_inr: Decimal
    status: str
    prior_reversal_count: int


class ActionResult(_Model):
    reference: str
    status: str


class ReplacementOrderInfo(_Model):
    reference: str
    status: str
    eta_date: datetime


class SettlementInfo(_Model):
    settlement_id: int
    amount_inr: Decimal
    status: str
    hold_reason: str | None


class KycDocumentInfo(_Model):
    doc_type: str
    status: str


class BillInfo(_Model):
    paid_at: datetime
    gateway_txn_id: str
    biller: str
    amount_inr: Decimal
    debited: bool
    biller_status: str


class RefundResult(_Model):
    refund_id: str
    status: str  # PENDING | SUCCESS | FAILURE
    amount_inr: Decimal


class DeviceClient(Protocol):
    def find_device(self, merchant_id: int, kind: str) -> DeviceStatus | None: ...
    def get_status(self, device_id: int) -> DeviceStatus: ...
    def remote_fix(self, device_id: int) -> FixResult: ...
    def repair(self, device_id: int) -> FixResult: ...


class BillingClient(Protocol):
    def get_rental(self, device_id: int) -> RentalInfo: ...
    def reverse_rent(
        self, rental_id: int, amount_inr: Decimal, idempotency_key: str
    ) -> ActionResult: ...
    def get_reversal(self, reference: str) -> ActionResult: ...


class LogisticsClient(Protocol):
    def create_replacement(self, device_id: int, idempotency_key: str) -> ActionResult: ...
    def get_order(self, reference: str) -> ReplacementOrderInfo: ...


class SettlementClient(Protocol):
    def get_held_settlement(self, merchant_id: int) -> SettlementInfo | None: ...
    def get_kyc_documents(self, merchant_id: int) -> list[KycDocumentInfo]: ...
    def submit_document(self, merchant_id: int, doc_type: str) -> KycDocumentInfo: ...
    def release_hold(self, merchant_id: int, idempotency_key: str) -> ActionResult: ...


class BillerClient(Protocol):
    def get_bill(self, gateway_txn_id: str) -> BillInfo: ...
    def list_bills(self, merchant_id: int) -> list[BillInfo]: ...


class PaymentGateway(Protocol):
    """Mirrors the shape of Paytm PG's Refund and Refund Status APIs."""

    def initiate_refund(
        self, refund_id: str, gateway_txn_id: str, amount_inr: Decimal
    ) -> RefundResult: ...
    def get_refund_status(self, refund_id: str) -> RefundResult: ...
