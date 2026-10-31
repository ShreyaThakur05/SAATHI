"""Tables backing the SIMULATED Paytm back-office systems.

These stand in for Paytm's internal device, billing, logistics, settlement, KYC and
payment-gateway systems. Saathi only reaches them through connector interfaces
(app/connectors), so going live means swapping implementations, not these tables.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, ForeignKey, Integer, Numeric, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

Money = Numeric(12, 2)


class Merchant(Base):
    __tablename__ = "merchants"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    language: Mapped[str] = mapped_column(String(8), default="hi")
    kyc_status: Mapped[str] = mapped_column(String(16), default="VERIFIED")
    fraud_flag: Mapped[bool] = mapped_column(default=False)
    # Merchant dashboard sign-in (standalone mode). Embedded hosts use host-issued tokens instead.
    email: Mapped[str | None] = mapped_column(String(160), unique=True)
    password_hash: Mapped[str | None] = mapped_column(String(256))
    city: Mapped[str] = mapped_column(String(64), default="")
    category: Mapped[str] = mapped_column(String(64), default="")
    address: Mapped[str] = mapped_column(String(160), default="", server_default="")
    lat: Mapped[float | None]  # simulated shop location
    lng: Mapped[float | None]
    member_since: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    kind: Mapped[str] = mapped_column(String(16))  # SOUNDBOX | CARD_MACHINE
    serial: Mapped[str] = mapped_column(String(32), unique=True)
    status: Mapped[str] = mapped_column(String(16), default="ONLINE")  # ONLINE | OFFLINE
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    sim_signal: Mapped[str] = mapped_column(String(8), default="GOOD")  # GOOD | WEAK | NONE
    # Simulation switch: does a remote restart bring it back, or is it a hardware fault?
    fixable_remotely: Mapped[bool] = mapped_column(default=True)
    pairing_ok: Mapped[bool] = mapped_column(default=True)


class Rental(Base):
    __tablename__ = "rentals"

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"))
    monthly_rent_inr: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[str] = mapped_column(String(16), default="ACTIVE")  # ACTIVE | RETURNED


class RentCharge(Base):
    __tablename__ = "rent_charges"

    id: Mapped[int] = mapped_column(primary_key=True)
    rental_id: Mapped[int] = mapped_column(ForeignKey("rentals.id"), index=True)
    amount_inr: Mapped[Decimal] = mapped_column(Money)
    charged_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class RentReversal(Base):
    __tablename__ = "rent_reversals"
    __table_args__ = (UniqueConstraint("idempotency_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(24), unique=True)
    rental_id: Mapped[int] = mapped_column(ForeignKey("rentals.id"), index=True)
    amount_inr: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[str] = mapped_column(String(16), default="SUCCESS")
    idempotency_key: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReplacementOrder(Base):
    __tablename__ = "replacement_orders"
    __table_args__ = (UniqueConstraint("idempotency_key"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    reference: Mapped[str] = mapped_column(String(24), unique=True)  # e.g. RPL-4471
    device_id: Mapped[int] = mapped_column(ForeignKey("devices.id"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="CREATED")
    eta_date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idempotency_key: Mapped[str] = mapped_column(String(64))


class BillPayment(Base):
    __tablename__ = "bill_payments"

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    gateway_txn_id: Mapped[str] = mapped_column(String(32), unique=True)
    biller: Mapped[str] = mapped_column(String(64))
    amount_inr: Mapped[Decimal] = mapped_column(Money)
    debited: Mapped[bool] = mapped_column(default=True)
    biller_status: Mapped[str] = mapped_column(String(16))  # SUCCESS | FAILED | PENDING
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class SimulatedRefund(Base):
    """Simulated Paytm Payment Gateway refund (mirrors the Refund / Refund Status API shape)."""

    __tablename__ = "simulated_refunds"

    id: Mapped[int] = mapped_column(primary_key=True)
    refund_id: Mapped[str] = mapped_column(String(48), unique=True)  # caller-supplied, idempotent
    gateway_txn_id: Mapped[str] = mapped_column(String(32), index=True)
    amount_inr: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[str] = mapped_column(String(16), default="PENDING")  # PENDING|SUCCESS|FAILURE
    status_polls: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Settlement(Base):
    __tablename__ = "settlements"

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    amount_inr: Mapped[Decimal] = mapped_column(Money)
    status: Mapped[str] = mapped_column(String(16))  # PAID | HELD | RELEASED
    hold_reason: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class KycDocument(Base):
    __tablename__ = "kyc_documents"
    __table_args__ = (UniqueConstraint("merchant_id", "doc_type"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    doc_type: Mapped[str] = mapped_column(String(24))  # PAN | GST | BANK_PROOF | SHOP_PHOTO
    status: Mapped[str] = mapped_column(String(16))  # VERIFIED | MISSING | MISMATCH


class Collection(Base):
    """Simulated payments received by the merchant (QR / UPI / card)."""

    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(primary_key=True)
    merchant_id: Mapped[int] = mapped_column(ForeignKey("merchants.id"), index=True)
    amount_inr: Mapped[Decimal] = mapped_column(Money)
    mode: Mapped[str] = mapped_column(String(8))  # UPI | CARD
    payer: Mapped[str] = mapped_column(String(48))  # masked, e.g. "UPI ••4821"
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
