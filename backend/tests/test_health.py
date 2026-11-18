from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from crm.main import create_app


def test_liveness_does_not_require_database():
    with TestClient(create_app()) as client:
        response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_readiness_returns_503_without_leaking_connection_details():
    class UnavailableSession:
        async def __aenter__(self):
            raise OperationalError("sensitive connection details", {}, Exception("offline"))

        async def __aexit__(self, *args):
            pass

    app = create_app()
    with TestClient(app) as client:
        app.state.session_factory = UnavailableSession
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database is unavailable"}
