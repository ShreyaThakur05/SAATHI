from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_session
from app.main import create_app


def test_healthz_needs_no_database() -> None:
    client = TestClient(create_app())
    res = client.get("/healthz")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_readyz_reports_503_when_database_down() -> None:
    class BrokenSession:
        def execute(self, *_: object) -> None:
            raise OperationalError("SELECT 1", {}, Exception("down"))

    app = create_app()
    app.dependency_overrides[get_session] = lambda: BrokenSession()
    res = TestClient(app).get("/readyz")
    assert res.status_code == 503
    assert res.json()["database"] == "down"


def test_unhandled_errors_do_not_leak_internals() -> None:
    app = create_app()

    @app.get("/boom")
    def boom() -> None:
        raise RuntimeError("secret internal detail")

    res = TestClient(app, raise_server_exceptions=False).get("/boom")
    assert res.status_code == 500
    assert "secret" not in res.text
    assert res.json()["error"]["code"] == "internal_error"
