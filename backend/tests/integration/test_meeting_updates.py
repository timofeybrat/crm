from concurrent.futures import ThreadPoolExecutor

import pytest
from test_meetings import create_company, create_meeting


def test_reschedule_preserves_history_and_original_fields(client):
    original = create_meeting(client, create_company(client)).json()
    for new_start in ["2026-11-24T05:00:00Z", "2026-11-25T06:00:00Z"]:
        response = client.patch(
            f"/meetings/{original['id']}",
            json={
                "action": "reschedule",
                "starts_at": new_start,
                "manager_id": 2,
            },
        )
        assert response.status_code == 200
    updated = client.get(f"/meetings/{original['id']}").json()
    assert updated["original_starts_at"] == original["starts_at"]
    assert updated["created_at"] == original["created_at"]
    assert [event["action"] for event in updated["history"]] == [
        "create",
        "reschedule",
        "reschedule",
    ]
    assert updated["history"][1]["old_manager_id"] == 1
    assert updated["history"][2]["old_starts_at"] == "2026-11-24T05:00:00Z"


def test_failed_reschedule_rolls_back_and_keeps_history(client):
    first = create_meeting(client, create_company(client, 1)).json()
    second = create_meeting(client, create_company(client, 2), "2026-11-23T06:00:00Z").json()
    response = client.patch(
        f"/meetings/{second['id']}",
        json={
            "action": "reschedule",
            "starts_at": first["starts_at"],
        },
    )
    assert response.status_code == 409
    assert client.get(f"/meetings/{second['id']}").json() == second


def test_cancel_is_idempotent_and_releases_slot(client):
    company = create_company(client)
    original = create_meeting(client, company).json()
    path = f"/meetings/{original['id']}"
    first = client.patch(path, json={"action": "cancel"})
    second = client.patch(path, json={"action": "cancel"})
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()
    assert create_meeting(client, company).status_code == 201
    assert (
        client.patch(
            path,
            json={
                "action": "reschedule",
                "starts_at": "2026-11-24T05:00:00Z",
            },
        ).status_code
        == 422
    )


def test_completion_releases_company_and_cannot_complete_future(client):
    company = create_company(client)
    old = create_meeting(client, company, "2020-01-06T05:00:00Z").json()
    path = f"/meetings/{old['id']}"
    assert client.patch(path, json={"action": "complete"}).status_code == 200
    assert client.patch(path, json={"action": "complete"}).status_code == 200
    future = create_meeting(client, company, "2099-01-05T05:00:00Z").json()
    assert client.patch(f"/meetings/{future['id']}", json={"action": "complete"}).status_code == 422


@pytest.mark.parametrize(
    "data",
    [
        {"action": "reschedule"},
        {"action": "cancel", "starts_at": "2026-11-23T05:00:00Z"},
        {"action": "other"},
        {"action": "reschedule", "starts_at": "2026-11-23T12:30:00Z"},
    ],
)
def test_invalid_patch(client, data):
    meeting = create_meeting(client, create_company(client)).json()
    assert client.patch(f"/meetings/{meeting['id']}", json=data).status_code == 422


def test_concurrent_reschedules_preserve_both_events(client):
    meeting = create_meeting(client, create_company(client)).json()
    path = f"/meetings/{meeting['id']}"
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(
                client.patch,
                path,
                json={
                    "action": "reschedule",
                    "starts_at": start,
                },
            )
            for start in ["2026-11-24T05:00:00Z", "2026-11-25T05:00:00Z"]
        ]
        assert [future.result().status_code for future in futures] == [200, 200]
    events = client.get(path).json()["history"]
    assert len(events) == 3
    assert events[2]["old_starts_at"] == events[1]["new_starts_at"]


def test_schedule_filters_and_sorting(client):
    later = create_meeting(client, create_company(client, 1), "2026-11-23T08:00:00Z").json()
    earlier = create_meeting(client, create_company(client, 2), "2026-11-23T04:00:00Z").json()
    create_meeting(client, create_company(client, 3), "2026-11-24T05:00:00Z")
    create_meeting(client, create_company(client, 4), manager_id=2)
    schedule = client.get("/managers/1/schedule?date=2026-11-23").json()
    assert [item["id"] for item in schedule["meetings"]] == [earlier["id"], later["id"]]
    assert client.get("/managers/1/schedule?date=2026-11-22").json()["meetings"] == []
    assert client.get("/managers/999/schedule?date=2026-11-23").status_code == 404
    assert client.get("/managers/1/schedule?date=invalid").status_code == 422
    assert client.get("/managers/1/schedule?date=9999-12-31").status_code == 422
    assert len(client.get("/managers").json()) == 2
