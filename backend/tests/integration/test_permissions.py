import pytest
from fastapi.testclient import TestClient

from crm.core.config import Settings
from crm.main import create_app


@pytest.mark.parametrize(
    "method,path,body",
    [
        ("GET", "/companies", None),
        ("GET", "/companies/1", None),
        ("GET", "/managers", None),
        ("GET", "/managers/1/schedule?date=2030-01-07", None),
        ("GET", "/meetings/1", None),
        ("POST", "/companies", {"name": "Test", "bin": "000000000001", "phone": "00000"}),
        ("POST", "/calls", {"company_id": 1, "result": "no_answer"}),
        (
            "POST",
            "/meetings",
            {"company_id": 1, "manager_id": 1, "starts_at": "2030-01-07T05:00:00Z"},
        ),
        ("PATCH", "/meetings/1", {"action": "cancel"}),
    ],
)
def test_all_crm_routes_require_login(db, test_database_url, method, path, body):
    with TestClient(create_app(Settings(database_url=test_database_url, video_enabled=False))) as c:
        assert c.request(method, path, json=body).status_code == 401


def test_manager_cannot_assign_transfer_cancel_or_link_another_managers_meeting(
    client, db, login_as, test_database_url
):
    company = client.post(
        "/companies", json={"name": "Team", "bin": "000000000001", "phone": "00000"}
    ).json()["id"]
    meeting = client.post(
        "/meetings",
        json={"company_id": company, "manager_id": 1, "starts_at": "2030-01-07T05:00:00Z"},
    ).json()["id"]
    with TestClient(
        create_app(Settings(database_url=test_database_url, video_enabled=False))
    ) as manager:
        login_as(manager, manager_id=2)
        assert manager.get("/companies").status_code == 200  # Shared team workspace.
        assert (
            manager.post(
                "/meetings",
                json={"company_id": company, "manager_id": 1, "starts_at": "2030-01-08T05:00:00Z"},
            ).status_code
            == 403
        )
        assert manager.patch(f"/meetings/{meeting}", json={"action": "cancel"}).status_code == 403
        assert (
            manager.patch(
                f"/meetings/{meeting}",
                json={"action": "reschedule", "manager_id": 2, "starts_at": "2030-01-08T05:00:00Z"},
            ).status_code
            == 403
        )
        assert (
            manager.post(
                "/calls",
                json={"company_id": company, "result": "meeting_set", "meeting_id": meeting},
            ).status_code
            == 403
        )
        assert db("SELECT status FROM meetings")[0]["status"] == "scheduled"
        other = manager.post(
            "/companies", json={"name": "Other", "bin": "000000000002", "phone": "00000"}
        ).json()["id"]
        own = manager.post(
            "/meetings",
            json={"company_id": other, "manager_id": 2, "starts_at": "2030-01-08T05:00:00Z"},
        )
        assert own.status_code == 201
        mid = own.json()["id"]
        assert (
            manager.patch(
                f"/meetings/{mid}",
                json={"action": "reschedule", "manager_id": 1, "starts_at": "2030-01-09T05:00:00Z"},
            ).status_code
            == 403
        )
        assert manager.patch(f"/meetings/{mid}", json={"action": "cancel"}).status_code == 200


def test_mutations_reject_missing_csrf_even_with_login(client):
    client.headers.pop("x-csrf-token")
    assert (
        client.post(
            "/companies", json={"name": "Test", "bin": "000000000001", "phone": "00000"}
        ).status_code
        == 403
    )
