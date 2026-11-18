from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

import pytest

from crm.modules.meetings import repository


def create_company(client, number=1):
    response = client.post(
        "/companies",
        json={
            "name": "Demo",
            "bin": f"{number:012d}",
            "phone": "00000",
        },
    )
    assert response.status_code == 201
    return response.json()["id"]


def create_meeting(client, company_id, starts_at="2026-11-23T05:00:00Z", manager_id=1):
    return client.post(
        "/meetings",
        json={
            "company_id": company_id,
            "manager_id": manager_id,
            "starts_at": starts_at,
        },
    )


def test_create_meeting_and_history(client):
    response = create_meeting(client, create_company(client))
    assert response.status_code == 201
    body = response.json()
    assert body["starts_at"] == body["original_starts_at"] == "2026-11-23T05:00:00Z"
    assert body["ends_at"] == "2026-11-23T06:00:00Z"
    assert [event["action"] for event in body["history"]] == ["create"]


@pytest.mark.parametrize(
    "start", ["2026-11-23T05:00:00Z", "2026-11-23T05:30:00Z", "2026-11-23T04:30:00Z"]
)
def test_overlapping_intervals_rejected(client, start):
    first, second = create_company(client, 1), create_company(client, 2)
    assert create_meeting(client, first).status_code == 201
    assert create_meeting(client, second, start).status_code == 409


def test_adjacent_meetings_allowed(client):
    first, second = create_company(client, 1), create_company(client, 2)
    assert create_meeting(client, first).status_code == 201
    assert create_meeting(client, second, "2026-11-23T06:00:00Z").status_code == 201


def test_company_cannot_have_second_active_meeting(client):
    company = create_company(client)
    assert create_meeting(client, company).status_code == 201
    assert create_meeting(client, company, "2026-11-24T06:00:00Z", 2).status_code == 409


@pytest.mark.parametrize(
    "start,code",
    [
        ("2026-11-23T04:00:00Z", 201),
        ("2026-11-23T12:00:00Z", 201),
        ("2026-11-23T12:30:00Z", 422),
        ("2026-11-21T05:00:00Z", 422),
        ("2026-11-23T03:59:00Z", 422),
    ],
)
def test_working_hours_through_api(client, start, code):
    assert create_meeting(client, create_company(client), start).status_code == code


def test_missing_company_and_manager(client):
    assert create_meeting(client, 999).status_code == 404
    assert create_meeting(client, create_company(client), manager_id=999).status_code == 404


@pytest.mark.parametrize("same_company", [False, True])
def test_concurrent_booking_database_is_final_guard(client, db, monkeypatch, same_company):
    first = create_company(client, 1)
    second = first if same_company else create_company(client, 2)
    barrier = Barrier(2)
    original = repository.check_availability

    async def synchronized_precheck(*args, **kwargs):
        import asyncio

        await original(*args, **kwargs)
        # Both independent transactions must pass prechecks before either INSERT.
        await asyncio.to_thread(barrier.wait, 10)

    monkeypatch.setattr(repository, "check_availability", synchronized_precheck)
    with ThreadPoolExecutor(max_workers=2) as pool:
        futures = [
            pool.submit(create_meeting, client, first),
            pool.submit(
                create_meeting, client, second, "2026-11-23T05:00:00Z", 2 if same_company else 1
            ),
        ]
        assert sorted(f.result().status_code for f in futures) == [201, 409]
    assert db("SELECT count(*) AS n FROM meetings")[0]["n"] == 1
    assert db("SELECT count(*) AS n FROM meeting_history")[0]["n"] == 1
