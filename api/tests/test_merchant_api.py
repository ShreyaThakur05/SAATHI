from fastapi.testclient import TestClient

from app.seed.demo import DEMO_PASSWORD
from tests.test_api import HEADLINE, merchant, say, staff


def login(client: TestClient, email: str, password: str = DEMO_PASSWORD) -> dict[str, str]:
    res = client.post("/v1/merchant/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['token']}"}


def get(client: TestClient, auth: dict[str, str], path: str):  # type: ignore[no-untyped-def]
    res = client.get(f"/v1/merchant/{path}", headers=auth)
    assert res.status_code == 200, res.text
    return res.json()


def test_login_good_bad_and_no_enumeration(client: TestClient) -> None:
    ok = client.post(
        "/v1/merchant/login", json={"email": "Ramesh@Store.Example", "password": DEMO_PASSWORD}
    )
    assert ok.status_code == 200 and ok.json()["merchant"]["name"] == "Ramesh General Store"
    assert "password" not in ok.text
    bad = client.post(
        "/v1/merchant/login", json={"email": "ramesh@store.example", "password": "nope"}
    )
    unknown = client.post(
        "/v1/merchant/login", json={"email": "nobody@store.example", "password": "nope"}
    )
    assert bad.status_code == unknown.status_code == 401 and bad.json() == unknown.json()
    assert client.post("/v1/merchant/login", json={"email": "", "password": ""}).status_code == 422


def test_dashboard_endpoints_need_a_merchant_token(client: TestClient) -> None:
    for path in ("overview", "devices", "settlements", "bills", "activity", "help-requests"):
        assert client.get(f"/v1/merchant/{path}").status_code == 401
        assert client.get(f"/v1/merchant/{path}", headers=staff(client)).status_code == 403


def test_overview_shows_real_collections_and_the_right_alerts(client: TestClient) -> None:
    ramesh = get(client, login(client, "ramesh@store.example"), "overview")
    assert ramesh["merchant"]["city"] == "Nagpur"
    assert ramesh["collections"]["week_count"] > 0 and float(ramesh["collections"]["week_inr"]) > 0
    assert ramesh["devices"] == {"total": 1, "online": 0}
    assert [a["kind"] for a in ramesh["alerts"]] == ["device_offline", "rent_while_down"]
    assert "49 hours" in ramesh["alerts"][0]["body"]
    assert "साउंडबॉक्स" in ramesh["alerts"][0]["ask"]  # Ramesh's language is Hindi

    anil = get(client, login(client, "anil@store.example"), "overview")
    assert [a["kind"] for a in anil["alerts"]] == ["settlement_held"]
    assert float(anil["settlement"]["held"]["amount_inr"]) == 48250

    priya = get(client, login(client, "priya@store.example"), "overview")
    assert [a["kind"] for a in priya["alerts"]] == ["bill_failed"]


def test_dashboard_reflects_what_saathi_fixed_for_the_soundbox_case(client: TestClient) -> None:
    auth = login(client, "ramesh@store.example")
    say(client, auth, HEADLINE)

    device = get(client, auth, "devices")[0]
    assert device["status"] == "OFFLINE" and device["replacement"]["reference"].startswith("RPL-")

    activity = get(client, auth, "activity")
    credit = next(a for a in activity if a["kind"] == "rent_reversal")
    assert float(credit["amount_inr"]) == 20 and credit["reference"].startswith("RV-")

    overview = get(client, auth, "overview")
    assert overview["alerts"] == []  # replacement on the way, so the offline alert is gone
    assert overview["open_help_requests"] == 0

    requests = get(client, auth, "help-requests")
    assert {r["status"] for r in requests} == {"RESOLVED"} and len(requests) == 2
    assert all("evidence" not in s and "detail" not in s for r in requests for s in r["steps"])
    assert any(r["references"] for r in requests)


def test_card_machine_goes_online_after_repair(client: TestClient) -> None:
    auth = login(client, "seema@store.example")
    assert get(client, auth, "devices")[0]["status"] == "OFFLINE"
    say(client, auth, "meri card machine swipe nahi kar rahi, offline hai")
    device = get(client, auth, "devices")[0]
    assert device["status"] == "ONLINE" and device["pairing_ok"] is True
    assert get(client, auth, "overview")["devices"] == {"total": 1, "online": 1}


def test_bill_refund_shows_in_bills_and_activity(client: TestClient) -> None:
    auth = login(client, "priya@store.example")
    say(client, auth, "bijli bill ka payment fail ho gaya par paise kat gaye")
    failed = next(b for b in get(client, auth, "bills") if b["biller_status"] == "FAILED")
    assert failed["refund"]["status"] == "SUCCESS"
    assert any(
        a["kind"] == "refund" and float(a["amount_inr"]) == 1840
        for a in get(client, auth, "activity")
    )
    assert get(client, auth, "overview")["alerts"] == []


def test_settlement_released_after_document_and_approval(client: TestClient) -> None:
    auth = login(client, "anil@store.example")
    case_id = say(client, auth, "mera settlement ruka hua hai")["case_ids"][0]
    assert (
        client.post(
            f"/v1/cases/{case_id}/documents", headers=auth, json={"doc_type": "GST"}
        ).status_code
        == 200
    )
    docs = get(client, auth, "settlements")["documents"]
    assert {d["doc_type"]: d["status"] for d in docs}["GST"] == "VERIFIED"
    assert (
        get(client, auth, "overview")["alerts"][0]["kind"] == "settlement_held"
    )  # not released yet

    risk = staff(client, "risk")
    approval = client.get("/v1/approvals", headers=risk).json()["items"][0]
    assert (
        client.post(
            f"/v1/approvals/{approval['id']}/decision", headers=risk, json={"approve": True}
        ).status_code
        == 200
    )
    states = {s["status"] for s in get(client, auth, "settlements")["settlements"]}
    assert "HELD" not in states and "RELEASED" in states
    assert get(client, auth, "overview")["alerts"] == []


def test_a_merchant_only_sees_their_own_data(client: TestClient) -> None:
    say(client, login(client, "ramesh@store.example"), HEADLINE)
    other = login(client, "priya@store.example")
    assert get(client, other, "help-requests") == []
    assert get(client, other, "devices") == []
    assert all(a["kind"] != "rent_reversal" for a in get(client, other, "activity"))


def test_embed_token_holders_can_use_the_dashboard_api_too(client: TestClient) -> None:
    # A host-issued token is the same kind of merchant token, so the widget and dashboard agree.
    auth = merchant(client, 1)
    assert get(client, auth, "overview")["merchant"]["name"] == "Ramesh General Store"


def test_contextual_help_messages_are_understood_and_resolve_the_alert(client: TestClient) -> None:
    """The text a 'Resolve with Saathi' button sends must actually route to the right case."""
    for email, kinds in (
        ("ramesh@store.example", {"device_offline", "rent_while_down"}),
        ("seema@store.example", {"device_offline"}),
        ("anil@store.example", {"settlement_held"}),
        ("priya@store.example", {"bill_failed"}),
    ):
        auth = login(client, email)
        alerts = get(client, auth, "overview")["alerts"]
        assert {a["kind"] for a in alerts} == kinds
        for alert in alerts:  # one click per alert, as a merchant would
            say(client, auth, alert["ask"])
        left = {a["kind"] for a in get(client, auth, "overview")["alerts"]}
        # settlement still needs the document + a person; everything else is fully fixed
        assert left == ({"settlement_held"} if email.startswith("anil") else set()), (email, left)
