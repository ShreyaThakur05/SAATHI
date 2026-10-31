from collections.abc import Callable
from dataclasses import dataclass
from functools import lru_cache
from typing import Annotated

from fastapi import Depends, Header
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import RateLimiter, decode_token
from app.db.models import User
from app.db.session import get_session
from app.services.runtime import Runtime, default_runtime

SessionDep = Annotated[Session, Depends(get_session)]


@lru_cache
def get_runtime() -> Runtime:
    return default_runtime()


RuntimeDep = Annotated[Runtime, Depends(get_runtime)]
SettingsDep = Annotated[Settings, Depends(get_settings)]

message_limiter = RateLimiter(limit=20, window_s=60)
login_limiter = RateLimiter(limit=10, window_s=60)  # per IP + email: stops guessing one account
login_ip_limiter = RateLimiter(limit=60, window_s=60)  # per IP: loose ceiling across accounts


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise AppError("unauthenticated", "Missing bearer token", 401)
    return authorization[7:].strip()


def current_staff(
    session: SessionDep,
    settings: SettingsDep,
    authorization: Annotated[str | None, Header()] = None,
) -> User:
    claims = decode_token(settings, _bearer(authorization))
    if claims.get("scope") != "staff":
        raise AppError("forbidden", "Staff access required", 403)
    user = session.get(User, int(claims["sub"]))
    if user is None:
        raise AppError("unauthenticated", "Unknown user", 401)
    return user


StaffDep = Annotated[User, Depends(current_staff)]


def require_role(*roles: str) -> Callable[[User], User]:
    def check(user: StaffDep) -> User:
        if user.role not in roles:
            raise AppError("forbidden", f"Requires role: {', '.join(roles)}", 403)
        return user

    return check


ApproverDep = Annotated[User, Depends(require_role("RISK_APPROVER", "ADMIN"))]
AdminDep = Annotated[User, Depends(require_role("ADMIN"))]


@dataclass(frozen=True)
class MerchantAuth:
    merchant_id: int
    language: str


def current_merchant(
    settings: SettingsDep, authorization: Annotated[str | None, Header()] = None
) -> MerchantAuth:
    claims = decode_token(settings, _bearer(authorization))
    if claims.get("scope") != "merchant":
        raise AppError("forbidden", "Merchant token required", 403)
    return MerchantAuth(int(claims["merchant_id"]), str(claims.get("lang", "hi")))


MerchantDep = Annotated[MerchantAuth, Depends(current_merchant)]


def host_key_ok(
    settings: SettingsDep, x_saathi_host_key: Annotated[str | None, Header()] = None
) -> None:
    import hmac

    expected = settings.host_api_key.get_secret_value()
    if not x_saathi_host_key or not hmac.compare_digest(x_saathi_host_key, expected):
        raise AppError("forbidden", "Invalid host key", 403)


HostDep = Depends(host_key_ok)
