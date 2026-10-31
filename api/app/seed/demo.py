"""Seed data for the four pitch scenarios. All data is fictional sample data."""

import random
from datetime import datetime, timedelta
from decimal import Decimal

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.connectors.simulated.systems import utcnow
from app.db.models import (
    BillPayment,
    Collection,
    Device,
    KycDocument,
    Merchant,
    Rental,
    RentCharge,
    Settlement,
)

SOUNDBOX_OFFLINE_HOURS = 49
AMOUNTS = [40, 60, 90, 120, 150, 250, 380, 520, 780, 1200]


def _seed_history(session: Session, merchant: Merchant, now: datetime) -> None:
    """A week of payments received and two settled payouts, so dashboards look lived-in."""
    rng = random.Random(merchant.id)  # deterministic per merchant
    for days_ago in range(7):
        day = (now - timedelta(days=days_ago)).replace(hour=0, minute=0, second=0, microsecond=0)
        for _ in range(rng.randint(5, 12)):
            when = day + timedelta(hours=rng.randint(9, 21), minutes=rng.randint(0, 59))
            if when > now:
                continue
            mode = rng.choice(["UPI", "UPI", "UPI", "CARD"])
            tail = rng.randint(1000, 9999)
            session.add(
                Collection(
                    merchant_id=merchant.id,
                    amount_inr=Decimal(rng.choice(AMOUNTS)),
                    mode=mode,
                    payer=f"{'UPI' if mode == 'UPI' else 'Card'} ••{tail}",
                    paid_at=when,
                )
            )
    for days_ago, amount in ((3, 21400), (1, 18950)):
        session.add(
            Settlement(
                merchant_id=merchant.id,
                amount_inr=Decimal(amount + merchant.id * 130),
                status="PAID",
                created_at=now - timedelta(days=days_ago),
            )
        )


def seed_demo(session: Session, now: datetime | None = None) -> dict[str, int]:
    """Insert demo data once. Returns ids by scenario; no-op if merchants already exist."""
    if session.scalars(select(Merchant.id)).first() is not None:
        return {}
    now = now or utcnow()

    from app.core.security import hash_password

    pw = hash_password(DEMO_PASSWORD)  # one hash is enough: all demo accounts share the password
    ramesh = Merchant(
        name="Ramesh General Store",
        language="hi",
        email="ramesh@store.example",
        password_hash=pw,
        city="Nagpur",
        category="Grocery",
    )
    seema = Merchant(
        name="Seema Boutique",
        language="hi",
        email="seema@store.example",
        password_hash=pw,
        city="Pune",
        category="Clothing",
    )
    anil = Merchant(
        name="Anil Electronics",
        language="hinglish",
        kyc_status="PENDING",
        email="anil@store.example",
        password_hash=pw,
        city="Indore",
        category="Electronics",
    )
    priya = Merchant(
        name="Priya Mobile Recharge",
        language="en",
        email="priya@store.example",
        password_hash=pw,
        city="Jaipur",
        category="Mobile and recharge",
    )
    session.add_all([ramesh, seema, anil, priya])
    session.flush()
    for merchant in (ramesh, seema, anil, priya):
        _seed_history(session, merchant, now)

    soundbox = Device(
        merchant_id=ramesh.id,
        kind="SOUNDBOX",
        serial="SB-77120",
        status="OFFLINE",
        last_seen_at=now - timedelta(hours=SOUNDBOX_OFFLINE_HOURS),
        sim_signal="WEAK",
        fixable_remotely=False,  # hardware fault: remote fix fails, replacement needed
    )
    card = Device(
        merchant_id=seema.id,
        kind="CARD_MACHINE",
        serial="CM-31008",
        status="OFFLINE",
        last_seen_at=now - timedelta(hours=6),
        pairing_ok=False,
        fixable_remotely=True,
    )
    session.add_all([soundbox, card])
    session.flush()

    rental = Rental(merchant_id=ramesh.id, device_id=soundbox.id, monthly_rent_inr=Decimal("300"))
    session.add(rental)
    session.flush()
    session.add(
        RentCharge(
            rental_id=rental.id, amount_inr=Decimal("300"), charged_at=now - timedelta(days=2)
        )
    )

    session.add_all(
        [
            Settlement(
                merchant_id=anil.id,
                amount_inr=Decimal("48250"),
                status="HELD",
                hold_reason="KYC_DOCUMENT_MISSING",
                created_at=now - timedelta(hours=20),
            ),
            KycDocument(merchant_id=anil.id, doc_type="PAN", status="VERIFIED"),
            KycDocument(merchant_id=anil.id, doc_type="GST", status="MISSING"),
            KycDocument(merchant_id=anil.id, doc_type="BANK_PROOF", status="VERIFIED"),
            BillPayment(
                merchant_id=priya.id,
                gateway_txn_id="TXN-BILL-1001",
                biller="Electricity (MSEDCL)",
                amount_inr=Decimal("1840"),
                biller_status="FAILED",
                paid_at=now - timedelta(hours=20),
            ),
            BillPayment(
                merchant_id=priya.id,
                gateway_txn_id="TXN-BILL-1002",
                biller="DTH Recharge",
                amount_inr=Decimal("499"),
                biller_status="SUCCESS",
                paid_at=now - timedelta(hours=30),
            ),
        ]
    )
    session.commit()
    return {
        "soundbox_merchant": ramesh.id,
        "soundbox_device": soundbox.id,
        "card_merchant": seema.id,
        "card_device": card.id,
        "settlement_merchant": anil.id,
        "bill_merchant": priya.id,
    }


STAFF = [
    ("agent@paytm.demo", "Asha Agent", "AGENT"),
    ("risk@paytm.demo", "Rina Risk", "RISK_APPROVER"),
    ("admin@paytm.demo", "Adi Admin", "ADMIN"),
]
DEMO_PASSWORD = "saathi-demo"  # DEMO ONLY: seeded when demo tools are enabled


def seed_staff(session: Session) -> None:
    from app.core.security import hash_password
    from app.db.models import User

    existing = set(session.scalars(select(User.email)))
    for email, name, role in STAFF:
        if email not in existing:
            session.add(
                User(email=email, name=name, role=role, password_hash=hash_password(DEMO_PASSWORD))
            )
    session.commit()


def reset_demo(session: Session) -> dict[str, int]:
    """Truncate every domain table (keeps staff users), then reseed the scenarios."""
    # Fail fast with a clear error instead of queueing behind a stuck connection.
    session.execute(text("SET LOCAL lock_timeout = '5s'"))
    session.execute(text("ALTER TABLE audit_log DISABLE TRIGGER audit_log_no_change"))
    session.execute(
        text(
            "TRUNCATE audit_log, approvals, actions, case_steps, messages, cases, conversations, "
            "simulated_refunds, rent_reversals, replacement_orders, rent_charges, rentals, "
            "bill_payments, settlements, kyc_documents, collections, devices, merchants "
            "RESTART IDENTITY CASCADE"
        )
    )
    session.execute(text("ALTER TABLE audit_log ENABLE TRIGGER audit_log_no_change"))
    session.commit()
    seed_staff(session)
    return seed_demo(session)
