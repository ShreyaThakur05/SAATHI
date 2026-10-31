"""Merchant dashboard API: sign-in plus read models over the merchant's own data."""

from typing import Any

from fastapi import APIRouter, Request
from sqlalchemy import select

from app.api.deps import MerchantDep, SessionDep, SettingsDep, login_ip_limiter, login_limiter
from app.core.errors import AppError
from app.core.security import issue_token, verify_password
from app.db.models import Merchant
from app.services import merchant_view

router = APIRouter(prefix="/v1/merchant", tags=["merchant dashboard"])


@router.post("/login")
def merchant_login(
    body: dict[str, str], request: Request, session: SessionDep, settings: SettingsDep
) -> dict[str, Any]:
    email = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""
    if not email or not password or len(email) > 160 or len(password) > 200:
        raise AppError("validation_error", "Invalid fields: email, password", 422)
    ip = request.client.host if request.client else "unknown"
    login_ip_limiter.check(ip)
    login_limiter.check(f"{ip}:{email}")
    merchant = session.scalars(select(Merchant).where(Merchant.email == email)).first()
    if (
        merchant is None
        or not merchant.password_hash
        or not verify_password(password, merchant.password_hash)
    ):
        raise AppError("invalid_credentials", "Wrong email or password", 401)
    token = issue_token(
        settings,
        {
            "sub": f"merchant:{merchant.id}",
            "scope": "merchant",
            "merchant_id": merchant.id,
            "lang": merchant.language,
        },
    )
    return {
        "token": token,
        "merchant": {"id": merchant.id, "name": merchant.name, "language": merchant.language},
    }


def _merchant(session: SessionDep, auth: MerchantDep) -> Merchant:
    merchant = session.get(Merchant, auth.merchant_id)
    if merchant is None:
        raise AppError("unknown_merchant", "Merchant not found", 404)
    return merchant


@router.get("/overview")
def overview(session: SessionDep, auth: MerchantDep) -> dict[str, Any]:
    return merchant_view.overview(session, _merchant(session, auth))


@router.get("/devices")
def devices(session: SessionDep, auth: MerchantDep) -> list[dict[str, Any]]:
    return merchant_view.devices(session, _merchant(session, auth).id)


@router.get("/settlements")
def settlements(session: SessionDep, auth: MerchantDep) -> dict[str, Any]:
    return merchant_view.settlements(session, _merchant(session, auth).id)


@router.get("/bills")
def bills(session: SessionDep, auth: MerchantDep) -> list[dict[str, Any]]:
    return merchant_view.bills(session, _merchant(session, auth).id)


@router.get("/activity")
def activity(session: SessionDep, auth: MerchantDep) -> list[dict[str, Any]]:
    return merchant_view.activity(session, _merchant(session, auth).id)


@router.get("/help-requests")
def help_requests(session: SessionDep, auth: MerchantDep) -> list[dict[str, Any]]:
    return merchant_view.help_requests(session, _merchant(session, auth).id)
