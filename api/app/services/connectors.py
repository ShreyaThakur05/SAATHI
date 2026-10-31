import time
from dataclasses import dataclass
from typing import Any, cast

from sqlalchemy.orm import Session

from app.connectors.base import (
    BillerClient,
    BillingClient,
    DeviceClient,
    LogisticsClient,
    PaymentGateway,
    SettlementClient,
)
from app.connectors.simulated.systems import (
    SimulatedBillerClient,
    SimulatedBillingClient,
    SimulatedDeviceClient,
    SimulatedLogisticsClient,
    SimulatedPaymentGateway,
    SimulatedSettlementClient,
)


@dataclass(frozen=True)
class Connectors:
    device: DeviceClient
    billing: BillingClient
    logistics: LogisticsClient
    settlement: SettlementClient
    biller: BillerClient
    gateway: PaymentGateway


class _Latency:
    """Adds realistic round-trip delay to every connector call (simulation only)."""

    def __init__(self, inner: object, delay_ms: int) -> None:
        self._inner = inner
        self._delay = delay_ms / 1000

    def __getattr__(self, name: str) -> Any:
        attr = getattr(self._inner, name)
        if not callable(attr) or self._delay <= 0:
            return attr

        def call(*args: Any, **kwargs: Any) -> Any:
            time.sleep(self._delay)
            return attr(*args, **kwargs)

        return call


def build_simulated_connectors(
    session: Session, latency_ms: int = 0, refund_success_after_polls: int = 2
) -> Connectors:
    def wrap(obj: object) -> Any:
        return _Latency(obj, latency_ms)

    return Connectors(
        device=cast(DeviceClient, wrap(SimulatedDeviceClient(session))),
        billing=cast(BillingClient, wrap(SimulatedBillingClient(session))),
        logistics=cast(LogisticsClient, wrap(SimulatedLogisticsClient(session))),
        settlement=cast(SettlementClient, wrap(SimulatedSettlementClient(session))),
        biller=cast(BillerClient, wrap(SimulatedBillerClient(session))),
        gateway=cast(
            PaymentGateway,
            wrap(SimulatedPaymentGateway(session, success_after_polls=refund_success_after_polls)),
        ),
    )
