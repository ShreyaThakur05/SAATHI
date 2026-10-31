import json
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker

from app.api.routes import _stream_case
from app.core.config import Settings, get_settings
from app.core.security import issue_token
from app.main import assert_safe_for_production
from app.seed.demo import DEMO_PASSWORD

HOST = {"X-Saathi-Host-Key": "dev-host-key"}
HEADLINE = "Soundbox do din se band hai, aur rent bhi kat gaya."


def staff(client: TestClient, who: str = "risk") -> dict[str, str]:
    res = client.post(
        "/v1/auth/login", json={"email": f"{who}@paytm.demo", "password": DEMO_PASSWORD}
    )
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def merchant(client: TestClient, merchant_id: int, lang: str = "hinglish") -> dict[str, str]:
    res = client.post(
        "/v1/embed/token", headers=HOST, json={"merchant_id": merchant_id, "language": lang}
    )
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def say(client: TestClient, auth: dict[str, str], text: str) -> dict[str, Any]:
    res = client.post("/v1/messages", headers=auth, json={"text": text})
    assert res.status_code == 202, res.text
    return res.json()


# ------------------------------------------------------------------------------- auth
def test_login_success_and_failure(client: TestClient) -> None:
    ok = client.post(
        "/v1/auth/login", json={"email": "agent@paytm.demo", "password": DEMO_PASSWORD}
    )
    assert ok.status_code == 200 and ok.json()["user"]["role"] == "AGENT"
    assert "password" not in ok.text
    bad = client.post("/v1/auth/login", json={"email": "agent@paytm.demo", "password": "nope"})
    assert bad.status_code == 401 and bad.json()["error"]["code"] == "invalid_credentials"
    unknown = client.post("/v1/auth/login", json={"email": "who@x.com", "password": "nope"})
    assert unknown.json() == bad.json()  # no user enumeration


def test_login_is_rate_limited_per_account_not_per_ip(client: TestClient) -> None:
    def attempt(email: str) -> int:
        return client.post("/v1/auth/login", json={"email": email, "password": "x"}).status_code

    codes = [attempt("a@b.c") for _ in range(12)]
    assert codes[:10] == [401] * 10 and 429 in codes[10:]
    # guessing one account does not lock everyone else out of the same office/NAT
    assert attempt("other@b.c") == 401


@pytest.mark.parametrize(
    "path", ["/v1/cases", "/v1/approvals", "/v1/audit", "/v1/metrics", "/v1/me"]
)
def test_console_endpoints_need_a_token(client: TestClient, path: str) -> None:
    assert client.get(path).status_code == 401
    assert client.get(path, headers={"Authorization": "Bearer garbage"}).status_code == 401


def test_expired_token_is_rejected(client: TestClient) -> None:
    token = issue_token(Settings(), {"sub": "1", "scope": "staff"}, ttl_minutes=-5)
    assert client.get("/v1/me", headers={"Authorization": f"Bearer {token}"}).status_code == 401


def test_scopes_do_not_cross(client: TestClient, ids: dict[str, int]) -> None:
    m = merchant(client, ids["soundbox_merchant"])
    assert client.get("/v1/cases", headers=m).status_code == 403  # merchant on staff API
    assert (
        client.post("/v1/messages", headers=staff(client), json={"text": "hi"}).status_code == 403
    )


def test_embed_token_needs_the_host_key(client: TestClient, ids: dict[str, int]) -> None:
    body = {"merchant_id": ids["soundbox_merchant"]}
    assert client.post("/v1/embed/token", json=body).status_code == 403
    assert (
        client.post("/v1/embed/token", json=body, headers={"X-Saathi-Host-Key": "x"}).status_code
        == 403
    )
    assert (
        client.post("/v1/embed/token", json={"merchant_id": 999}, headers=HOST).status_code == 404
    )


def test_agent_cannot_approve_but_risk_can(client: TestClient, ids: dict[str, int]) -> None:
    m = merchant(client, ids["settlement_merchant"])
    case_id = say(client, m, "mera settlement ruka hua hai")["case_ids"][0]
    assert (
        client.post(
            f"/v1/cases/{case_id}/documents", headers=m, json={"doc_type": "GST"}
        ).status_code
        == 200
    )
    approval = client.get("/v1/approvals", headers=staff(client, "agent")).json()["items"][0]
    url = f"/v1/approvals/{approval['id']}/decision"
    assert (
        client.post(url, headers=staff(client, "agent"), json={"approve": True}).status_code == 403
    )
    assert (
        client.post(url, headers=staff(client, "risk"), json={"approve": True}).status_code == 200
    )


# ------------------------------------------------------------------------ full HTTP flow
def test_headline_flow_over_http(client: TestClient, ids: dict[str, int]) -> None:
    m = merchant(client, ids["soundbox_merchant"])
    accepted = say(client, m, HEADLINE)
    assert len(accepted["case_ids"]) == 2

    msgs = client.get("/v1/conversations/latest/messages", headers=m).json()
    roles = [x["role"] for x in msgs]
    assert roles == ["MERCHANT", "SAATHI", "SAATHI"]  # message, ack, one combined result
    result = msgs[-1]
    assert result["card"]["state"] == "resolved"
    refs = {i["ref"] for i in result["card"]["items"]}
    assert any(r.startswith("RPL-") for r in refs) and any(r.startswith("RV-") for r in refs)

    # incremental polling: only new messages after the last id
    assert (
        client.get(f"/v1/conversations/latest/messages?after={msgs[-1]['id']}", headers=m).json()
        == []
    )

    s = staff(client)
    cases = client.get("/v1/cases", headers=s).json()
    assert cases["total"] == 2 and {c["status"] for c in cases["items"]} == {"RESOLVED"}
    detail = client.get(f"/v1/cases/{accepted['case_ids'][1]}", headers=s).json()
    assert [st["kind"] for st in detail["steps"]][-3:] == ["ACT", "PROVE", "REPLY"]
    assert detail["actions"][0]["proved"] is True


def test_metrics_after_scenario(client: TestClient, ids: dict[str, int]) -> None:
    say(client, merchant(client, ids["soundbox_merchant"]), HEADLINE)
    say(client, merchant(client, ids["bill_merchant"]), "refund five thousand rupees now")
    m = client.get("/v1/metrics", headers=staff(client)).json()
    assert m["cases_total"] == 3
    assert m["solved_without_person"]["count"] == 2
    assert m["by_status"] == {"RESOLVED": 2, "BLOCKED": 1}
    assert m["actions_confirmed_success"] == {"confirmed": 2, "attempted": 3, "rate": 0.6667}
    assert m["understanding_modes"] == {"keyword": 3}
    assert m["illustrative"]["estimated_saving_inr"] == "80"  # 2 cases x Rs40 (AI cost is 0)
    assert m["median_time_to_resolve_s"] is not None


def test_audit_endpoint_filters(client: TestClient, ids: dict[str, int]) -> None:
    case_id = say(
        client, merchant(client, ids["bill_merchant"]), "bijli bill fail ho gaya paise kat gaye"
    )["case_ids"][0]
    s = staff(client)
    page = client.get(f"/v1/audit?case_id={case_id}&event=step.prove", headers=s).json()
    assert page["total"] >= 1 and all(r["event"] == "step.prove" for r in page["items"])
    assert client.get("/v1/audit?limit=1000", headers=s).status_code == 422


def test_skill_pack_viewer(client: TestClient) -> None:
    packs = client.get("/v1/skill-packs", headers=staff(client)).json()
    by = {p["skill_pack"]: p for p in packs}
    assert by["soundbox"]["action_limits_inr"] == {"reverse_rent": "500"}
    assert "skill_pack: soundbox" in by["soundbox"]["source_yaml"]
    assert by["upi"]["status"] == "roadmap"


# ------------------------------------------------------------------------- isolation
def test_merchants_cannot_see_each_others_data(client: TestClient, ids: dict[str, int]) -> None:
    a = merchant(client, ids["settlement_merchant"])
    b = merchant(client, ids["bill_merchant"])
    accepted = say(client, a, "mera settlement ruka hua hai")
    convo = accepted["conversation_id"]
    assert client.get(f"/v1/conversations/{convo}/messages", headers=a).status_code == 200
    assert client.get(f"/v1/conversations/{convo}/messages", headers=b).status_code == 404
    res = client.post(
        f"/v1/cases/{accepted['case_ids'][0]}/documents", headers=b, json={"doc_type": "GST"}
    )
    assert res.status_code == 404
    assert (
        client.post(
            "/v1/messages", headers=b, json={"text": "hi", "conversation_id": convo}
        ).status_code
        == 404
    )


# ------------------------------------------------------------------------- validation
@pytest.mark.parametrize(
    "payload", [{"text": ""}, {"text": "x" * 1001}, {}, {"text": "hi", "input_mode": "fax"}]
)
def test_invalid_messages_are_rejected_without_echoing_input(
    client: TestClient, ids: dict[str, int], payload: dict[str, Any]
) -> None:
    res = client.post("/v1/messages", headers=merchant(client, ids["bill_merchant"]), json=payload)
    assert res.status_code == 422 and res.json()["error"]["code"] == "validation_error"
    assert "xxxx" not in res.text


def test_unknown_resources_give_404(client: TestClient) -> None:
    s = staff(client)
    assert client.get("/v1/cases/999", headers=s).status_code == 404
    assert (
        client.post("/v1/approvals/999/decision", headers=s, json={"approve": True}).status_code
        == 404
    )
    assert client.get("/v1/cases?status=bad-value", headers=s).status_code == 422


def test_message_rate_limit(client: TestClient, ids: dict[str, int]) -> None:
    m = merchant(client, ids["bill_merchant"])
    codes = [
        client.post("/v1/messages", headers=m, json={"text": "hello"}).status_code
        for _ in range(22)
    ]
    assert codes[:20] == [202] * 20 and codes[20] == 429


# ------------------------------------------------------------------------------- SSE
def test_stream_replays_steps_then_signals_done(
    engine, client: TestClient, ids: dict[str, int]
) -> None:  # type: ignore[no-untyped-def]
    case_id = say(
        client, merchant(client, ids["bill_merchant"]), "bijli bill fail ho gaya paise kat gaye"
    )["case_ids"][0]
    events = list(_stream_case(sessionmaker(engine), case_id, poll_s=0.01))
    kinds = [e.split("\n")[0] for e in events]
    assert kinds[-1] == "event: done" and kinds.count("event: step") >= 6
    first = json.loads(events[0].split("data: ")[1])
    assert first["kind"] == "LISTEN"
    assert json.loads(events[-1].split("data: ")[1])["status"] == "RESOLVED"
    assert next(_stream_case(sessionmaker(engine), 9999, poll_s=0.01)).startswith("event: error")


def test_stream_requires_staff_auth(client: TestClient) -> None:
    assert client.get("/v1/cases/1/stream").status_code == 401


# ------------------------------------------------------------------------- demo tools
def test_demo_reset_is_admin_only_and_restores_scenarios(
    client: TestClient, ids: dict[str, int]
) -> None:
    say(client, merchant(client, ids["soundbox_merchant"]), HEADLINE)
    assert client.post("/v1/demo/reset", headers=staff(client, "risk")).status_code == 403
    assert client.post("/v1/demo/reset", headers=staff(client, "admin")).status_code == 200
    assert client.get("/v1/cases", headers=staff(client)).json()["total"] == 0
    # data is back: the same scenario works again and is NOT a repeat claim
    m = merchant(client, 1)
    say(client, m, HEADLINE)
    assert {
        c["status"] for c in client.get("/v1/cases", headers=staff(client)).json()["items"]
    } == {"RESOLVED"}


# --------------------------------------------------------------------------- config
def test_production_refuses_development_defaults() -> None:
    with pytest.raises(RuntimeError, match="Unsafe production"):
        assert_safe_for_production(Settings(env="production"))
    assert_safe_for_production(
        Settings(
            env="production", jwt_secret="x" * 40, host_api_key="y" * 40, demo_tools_enabled=False
        )  # type: ignore[arg-type]
    )


def test_internal_errors_are_not_leaked(client: TestClient, ids: dict[str, int]) -> None:
    res = client.get("/v1/cases", headers=staff(client), params={"limit": "abc"})
    assert res.status_code == 422 and "abc" not in res.text
    _ = datetime.now(UTC) - timedelta(seconds=1)


def test_stream_releases_its_database_session_before_yielding(engine, client: TestClient) -> None:  # type: ignore[no-untyped-def]
    """A suspended stream must not hold an open transaction (it would block admin work)."""
    from sqlalchemy import text

    gen = _stream_case(sessionmaker(engine), 9999, poll_s=0.01)
    assert next(gen).startswith("event: error")  # generator is now suspended at its yield
    with engine.connect() as conn:
        idle = conn.execute(
            text(
                "select count(*) from pg_stat_activity where datname = current_database() "
                "and state = 'idle in transaction'"
            )
        ).scalar()
    assert idle == 0
    gen.close()


def test_demo_tools_are_off_by_default() -> None:
    assert Settings().demo_tools_enabled is False


def test_demo_endpoints_404_when_disabled(client: TestClient, ids: dict[str, int]) -> None:
    client.app.dependency_overrides[get_settings] = lambda: Settings(demo_tools_enabled=False)  # type: ignore[attr-defined]
    assert client.get("/v1/demo/merchants", headers=HOST).status_code == 404
    assert client.post("/v1/demo/reset", headers=staff(client, "admin")).status_code == 404


def test_system_status_is_honest_about_what_is_simulated(client: TestClient) -> None:
    res = client.get("/v1/system/status", headers=staff(client)).json()
    assert res["understanding"] == {"mode": "keyword", "model": None}
    kinds = {i["name"]: i["kind"] for i in res["integrations"]}
    assert kinds["Payment gateway (Refund and Refund Status APIs)"] == "simulated"
    assert kinds["WhatsApp"] == "not_configured"
    assert client.get("/v1/system/status").status_code == 401


def test_api_still_starts_and_reports_not_ready_when_the_database_is_down(monkeypatch) -> None:  # type: ignore[no-untyped-def]
    """Demo seeding must not turn a database outage into a crash loop."""
    import app.main as main
    from app.db import session as db_session

    bad = Settings(
        demo_tools_enabled=True, database_url="postgresql+psycopg://u:p@127.0.0.1:1/none"
    )
    monkeypatch.setattr(main, "get_settings", lambda: bad)
    monkeypatch.setattr(db_session, "get_settings", lambda: bad)
    db_session.get_engine.cache_clear()
    try:
        with TestClient(main.create_app()) as c:  # entering runs the lifespan
            assert c.get("/healthz").status_code == 200
            assert c.get("/readyz").status_code == 503
    finally:
        db_session.get_engine.cache_clear()
