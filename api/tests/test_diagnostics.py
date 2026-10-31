from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

from app.services.telemetry import SERIES_LEN, connection_path, heartbeat_series
from tests.test_api import HEADLINE, say, staff
from tests.test_merchant_api import get, login

NOW = datetime(2026, 10, 30, 12, 0, 7, tzinfo=UTC)


# ------------------------------------------------------------------ pure telemetry
def test_online_good_signal_heartbeats_all_arrive_and_are_fast() -> None:
    s = heartbeat_series("SB-1", "ONLINE", "GOOD", NOW, NOW)
    assert len(s) == SERIES_LEN and all(b["rtt_ms"] is not None for b in s)
    assert all(60 <= b["rtt_ms"] <= 110 for b in s)
    assert [b["t"] for b in s] == sorted(b["t"] for b in s)  # oldest first


def test_series_is_deterministic_and_slides_with_time() -> None:
    a = heartbeat_series("SB-1", "ONLINE", "WEAK", NOW, NOW)
    assert a == heartbeat_series("SB-1", "ONLINE", "WEAK", NOW, NOW)
    later = heartbeat_series("SB-1", "ONLINE", "WEAK", NOW, NOW + timedelta(seconds=5))
    assert later[:-1] == a[1:]  # the window slid by exactly one slot: consistent across polls


def test_weak_signal_is_slow_and_drops_some_heartbeats() -> None:
    s = heartbeat_series("SB-1", "ONLINE", "WEAK", NOW, NOW + timedelta(seconds=600))
    got = [b["rtt_ms"] for b in s if b["rtt_ms"] is not None]
    assert got and min(got) > 150  # clearly slower than a good link
    assert heartbeat_series("SB-2", "ONLINE", "WEAK", NOW, NOW)  # other devices differ, no crash


def test_offline_device_has_no_heartbeats_after_it_was_last_seen() -> None:
    last_seen = NOW - timedelta(hours=49)
    s = heartbeat_series("SB-1", "OFFLINE", "WEAK", last_seen, NOW)
    assert all(b["rtt_ms"] is None for b in s)
    none = heartbeat_series("SB-1", "ONLINE", "NONE", NOW, NOW)
    assert all(b["rtt_ms"] is None for b in none)  # no SIM signal, nothing gets through


def test_connection_path_names_the_broken_hop() -> None:
    assert connection_path("ONLINE", "GOOD")["failing_hop"] is None
    assert connection_path("ONLINE", "WEAK")["link_tower"] == "degraded"
    assert connection_path("OFFLINE", "WEAK")["failing_hop"] == "device_tower"
    fault = connection_path("OFFLINE", "GOOD")
    assert fault["failing_hop"] == "device" and fault["device"] == "fault"


# ------------------------------------------------------------------ merchant API
def device_id(client: TestClient, auth: dict[str, str]) -> int:
    return get(client, auth, "devices")[0]["id"]


def test_diagnostics_for_the_offline_soundbox(client: TestClient) -> None:
    auth = login(client, "ramesh@store.example")
    d = get(client, auth, f"devices/{device_id(client, auth)}/diagnostics")
    assert d["source"] == "simulated telemetry"
    assert d["device"]["status"] == "OFFLINE" and d["signal"]["quality"] == "WEAK"
    assert d["path"]["failing_hop"] == "device_tower"
    hb = d["heartbeat"]
    assert hb["median_rtt_ms"] is None and hb["missed_recent"] == hb["window"] == 24
    assert d["work"] is None  # nobody has asked Saathi anything yet


def test_diagnostics_show_saathis_live_work_on_the_device(client: TestClient) -> None:
    auth = login(client, "ramesh@store.example")
    say(client, auth, HEADLINE)
    d = get(client, auth, f"devices/{device_id(client, auth)}/diagnostics")
    work = d["work"]
    kinds = [s["kind"] for s in work["steps"]]
    assert work["active"] is False and work["status"] == "RESOLVED"
    assert "ACT" in kinds and "PROVE" in kinds
    assert any(
        "hardware fault" in s["title"] or "did not work" in s["title"] for s in work["steps"]
    )


def test_a_repaired_card_machine_starts_heartbeating(client: TestClient) -> None:
    auth = login(client, "seema@store.example")
    did = device_id(client, auth)
    before = get(client, auth, f"devices/{did}/diagnostics")
    assert (
        before["path"]["failing_hop"] == "device"
    )  # signal is fine: the device itself is at fault
    say(client, auth, "meri card machine swipe nahi kar rahi, offline hai")
    after = get(client, auth, f"devices/{did}/diagnostics")
    assert after["path"]["failing_hop"] is None and after["device"]["status"] == "ONLINE"
    assert (
        after["heartbeat"]["median_rtt_ms"] is not None and after["heartbeat"]["missed_recent"] == 0
    )


def test_a_merchant_cannot_read_another_merchants_device(client: TestClient) -> None:
    ramesh = login(client, "ramesh@store.example")
    did = device_id(client, ramesh)
    priya = login(client, "priya@store.example")
    assert client.get(f"/v1/merchant/devices/{did}/diagnostics", headers=priya).status_code == 404
    assert client.get("/v1/merchant/devices/999/diagnostics", headers=priya).status_code == 404
    assert client.get(f"/v1/merchant/devices/{did}/diagnostics").status_code == 401


def test_profile_has_location_stats_and_history(client: TestClient) -> None:
    auth = login(client, "ramesh@store.example")
    p = get(client, auth, "profile")
    assert p["merchant"]["city"] == "Nagpur" and "Itwari" in p["merchant"]["address"]
    loc = p["location"]
    assert loc["source"] == "simulated location" and 20 < loc["shop"]["lat"] < 22
    assert len(loc["devices"]) == 1 and loc["tower"]["lat"] != loc["shop"]["lat"]
    assert p["stats"]["devices"] == 1 and float(p["stats"]["collections_inr"]) > 0
    assert p["history"][-1]["title"] == "Joined"  # oldest event is the account opening


def test_history_records_what_saathi_did_in_time_order(client: TestClient) -> None:
    auth = login(client, "ramesh@store.example")
    say(client, auth, HEADLINE)
    p = get(client, auth, "profile")
    titles = [e["title"] for e in p["history"]]
    assert "Replacement ordered" in titles and "Rent reversed" in titles
    assert any(t.startswith("Remote restart attempted") for t in titles)
    stamps = [e["ts"] for e in p["history"]]
    assert stamps == sorted(stamps, reverse=True)
    assert p["stats"]["requests"] == 2 and p["stats"]["resolved"] == 2
    assert p["stats"]["solved_by_saathi"] == 2


# ------------------------------------------------------------------ staff "merchant 360"
def test_staff_can_search_merchants_and_open_a_360_view(client: TestClient) -> None:
    s = staff(client)
    everyone = client.get("/v1/merchants", headers=s).json()
    assert {m["name"] for m in everyone} >= {"Ramesh General Store", "Anil Electronics"}
    found = client.get("/v1/merchants?q=nagp", headers=s).json()
    assert [m["name"] for m in found] == ["Ramesh General Store"]
    mid = found[0]["id"]
    p = client.get(f"/v1/merchants/{mid}/profile", headers=s).json()
    assert p["merchant"]["name"] == "Ramesh General Store" and p["location"]["tower"]
    did = p["devices"][0]["id"]
    assert (
        client.get(f"/v1/merchants/{mid}/devices/{did}/diagnostics", headers=s).status_code == 200
    )
    other = next(m["id"] for m in everyone if m["id"] != mid)
    assert (
        client.get(f"/v1/merchants/{other}/devices/{did}/diagnostics", headers=s).status_code == 404
    )
    assert client.get("/v1/merchants/999/profile", headers=s).status_code == 404


def test_merchant_tokens_cannot_use_the_staff_merchant_endpoints(client: TestClient) -> None:
    auth = login(client, "ramesh@store.example")
    assert client.get("/v1/merchants", headers=auth).status_code == 403
    assert client.get("/v1/merchants/1/profile", headers=auth).status_code == 403
    assert client.get("/v1/merchants").status_code == 401
