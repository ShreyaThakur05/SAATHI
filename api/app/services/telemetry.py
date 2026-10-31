"""SIMULATED device telemetry: heartbeats, signal and the connection path.

There is no real device fleet here. These values are derived deterministically from the device's
state in the simulated systems (status, SIM signal, last seen), so the picture always agrees with
the data, and consecutive polls form a consistent series. Everything returned is labelled simulated.
"""

import zlib
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import Case, CaseStep, Device
from app.domain.types import TERMINAL_STATUSES

HEARTBEAT_INTERVAL_S = 5
SERIES_LEN = 24
_BASE_RTT = {"GOOD": 85, "WEAK": 270, "NONE": 0}
_DBM = {"GOOD": -72, "WEAK": -104, "NONE": -120}


def _noise(serial: str, bucket: int) -> float:
    """Stable pseudo-random value in [0, 1) for one device and one heartbeat slot."""
    return (zlib.crc32(f"{serial}:{bucket}".encode()) % 10_000) / 10_000


def heartbeat_series(
    serial: str, status: str, signal: str, last_seen: datetime, now: datetime
) -> list[dict[str, Any]]:
    """Most recent heartbeat slots, oldest first. `rtt_ms` is None for a missed heartbeat."""
    now_bucket = int(now.timestamp() // HEARTBEAT_INTERVAL_S)
    out = []
    for i in range(SERIES_LEN - 1, -1, -1):
        bucket = now_bucket - i
        t = datetime.fromtimestamp(bucket * HEARTBEAT_INTERVAL_S, UTC)
        n = _noise(serial, bucket)
        alive = (status == "ONLINE" or t <= last_seen) and signal != "NONE"
        if alive and signal == "WEAK" and n < 0.22:
            alive = False  # a weak SIM drops some heartbeats even when "online"
        rtt = round(_BASE_RTT[signal] * (0.75 + 0.5 * n)) if alive else None
        out.append({"t": t, "rtt_ms": rtt})
    return out


def connection_path(status: str, signal: str) -> dict[str, Any]:
    """Which hop of device -> cell site -> Paytm gateway is healthy, degraded or broken."""
    if status == "ONLINE":
        link = "degraded" if signal == "WEAK" else "ok"
        return {"device": "ok", "link_tower": link, "link_gateway": "ok", "failing_hop": None}
    if signal in {"WEAK", "NONE"}:  # cannot reach the cell site
        return {
            "device": "ok",
            "link_tower": "down",
            "link_gateway": "ok",
            "failing_hop": "device_tower",
        }
    return {"device": "fault", "link_tower": "down", "link_gateway": "ok", "failing_hop": "device"}


def _active_work(session: Session, device: Device) -> dict[str, Any] | None:
    """The newest Saathi case on this kind of device, with its steps (what is being checked now)."""
    # only cases about the device itself (not, say, a rent dispute on the same product)
    intent = "device_fault" if device.kind == "SOUNDBOX" else "card_machine_issue"
    case = session.scalars(
        select(Case)
        .where(Case.merchant_id == device.merchant_id, Case.intent == intent)
        .order_by(Case.id.desc())
    ).first()
    if case is None:
        return None
    steps = list(
        session.scalars(
            select(CaseStep)
            .where(CaseStep.case_id == case.id)
            .order_by(CaseStep.seq.desc())
            .limit(8)
        )
    )[::-1]
    return {
        "case_id": case.id,
        "summary": case.summary,
        "status": case.status,
        "active": case.status not in {s.value for s in TERMINAL_STATUSES}
        and case.status not in {"AWAITING_APPROVAL", "WAITING_MERCHANT"},
        "steps": [
            {"seq": s.seq, "kind": s.kind, "status": s.status, "title": s.title, "at": s.created_at}
            for s in steps
        ],
    }


def diagnostics(session: Session, device: Device, now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(UTC)
    last_seen = (
        device.last_seen_at
        if device.last_seen_at.tzinfo
        else device.last_seen_at.replace(tzinfo=UTC)
    )
    series = heartbeat_series(device.serial, device.status, device.sim_signal, last_seen, now)
    rtts = sorted(b["rtt_ms"] for b in series if b["rtt_ms"] is not None)
    missed = sum(1 for b in series if b["rtt_ms"] is None)
    return {
        "source": "simulated telemetry",
        "device": {
            "id": device.id,
            "kind": device.kind,
            "serial": device.serial,
            "status": device.status,
            "pairing_ok": device.pairing_ok,
        },
        "signal": {"quality": device.sim_signal, "dbm": _DBM[device.sim_signal]},
        "heartbeat": {
            "interval_s": HEARTBEAT_INTERVAL_S,
            "last_seen_at": last_seen,
            "median_rtt_ms": rtts[len(rtts) // 2] if rtts else None,
            "missed_recent": missed,
            "window": SERIES_LEN,
            "series": series,
        },
        "path": connection_path(device.status, device.sim_signal),
        "work": _active_work(session, device),
        "as_of": now,
    }
