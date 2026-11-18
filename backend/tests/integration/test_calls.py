import pytest
from test_meetings import create_company, create_meeting

from crm.core.errors import InvalidOperation
from crm.modules.calls import repository


@pytest.mark.parametrize("result", ["no_answer", "refused", "meeting_set"])
def test_call_outcomes_update_status_and_filter(client, result):
    company = create_company(client)
    data = {"company_id": company, "result": result}
    if result == "meeting_set":
        data["meeting_id"] = create_meeting(client, company).json()["id"]
    response = client.post("/calls", json=data)
    assert response.status_code == 201
    assert response.json()["result"] == result
    assert [item["id"] for item in client.get(f"/companies?status={result}").json()["items"]] == [
        company,
    ]


def test_meeting_set_requires_existing_correct_active_meeting(client, db):
    first, second = create_company(client, 1), create_company(client, 2)
    data = {"company_id": first, "result": "meeting_set"}
    assert client.post("/calls", json=data).status_code == 422
    assert client.post("/calls", json={**data, "meeting_id": 999}).status_code == 404
    meeting = create_meeting(client, second).json()["id"]
    assert client.post("/calls", json={**data, "meeting_id": meeting}).status_code == 422
    client.patch(f"/meetings/{meeting}", json={"action": "cancel"})
    assert (
        client.post(
            "/calls",
            json={
                **data,
                "company_id": second,
                "meeting_id": meeting,
            },
        ).status_code
        == 422
    )
    assert db("SELECT count(*) AS n FROM calls")[0]["n"] == 0
    assert all(item["status"] == "new" for item in client.get("/companies").json()["items"])


def test_other_outcomes_cannot_link_meeting(client):
    company = create_company(client)
    meeting = create_meeting(client, company).json()["id"]
    assert (
        client.post(
            "/calls",
            json={
                "company_id": company,
                "result": "no_answer",
                "meeting_id": meeting,
            },
        ).status_code
        == 422
    )
    assert client.post("/calls", json={"company_id": 999, "result": "refused"}).status_code == 404


def test_call_and_status_update_rollback_together(client, db, monkeypatch):
    company = create_company(client)
    original = repository.add_call

    async def fail_after_flush(*args):
        await original(*args)
        raise InvalidOperation("Simulated failure after database flush")

    monkeypatch.setattr(repository, "add_call", fail_after_flush)
    assert (
        client.post(
            "/calls",
            json={
                "company_id": company,
                "result": "refused",
            },
        ).status_code
        == 422
    )
    assert db("SELECT status FROM companies WHERE id = :id", {"id": company})[0]["status"] == "new"
    assert db("SELECT count(*) AS n FROM calls")[0]["n"] == 0


def test_latest_call_status_is_independent_of_meeting_status(client):
    company = create_company(client)
    meeting = create_meeting(client, company).json()["id"]
    client.post(
        "/calls",
        json={
            "company_id": company,
            "result": "meeting_set",
            "meeting_id": meeting,
        },
    )
    client.patch(f"/meetings/{meeting}", json={"action": "cancel"})
    assert client.get("/companies").json()["items"][0]["status"] == "meeting_set"
    client.post("/calls", json={"company_id": company, "result": "refused"})
    assert client.get("/companies").json()["items"][0]["status"] == "refused"
