import asyncio
from datetime import date, datetime

import pytest
from pydantic import ValidationError

from crm.core.errors import InvalidOperation
from crm.modules.managers import service as manager_service
from crm.modules.meetings.rules import meeting_end
from crm.modules.meetings.schemas import MeetingCreate


@pytest.mark.parametrize("value", ["2026-11-23T04:00:00Z", "2026-11-23T12:00:00Z"])
def test_workday_boundaries_allowed(value):
    start = datetime.fromisoformat(value)
    assert (meeting_end(start) - start).total_seconds() == 3600


@pytest.mark.parametrize(
    "value",
    [
        "2026-11-23T03:59:00Z",
        "2026-11-23T12:30:00Z",
        "2026-11-21T05:00:00Z",
        "2026-11-22T05:00:00Z",
        "2026-11-23T12:00:00.000001Z",
    ],
)
def test_outside_workday_rejected(value):
    with pytest.raises(InvalidOperation):
        meeting_end(datetime.fromisoformat(value))


@pytest.mark.parametrize("value", ["2026-11-23T10:00:00", "2026-11-23T10:00:00+05:00", 1234])
def test_only_utc_iso_datetimes_accepted(value):
    with pytest.raises(ValidationError):
        MeetingCreate(company_id=1, manager_id=1, starts_at=value)


def test_schedule_uses_local_day_boundaries(monkeypatch):
    async def get_manager(*args):
        return None

    async def list_schedule(session, manager, start, end):
        assert manager == 1
        assert start.isoformat() == "2026-11-22T19:00:00+00:00"
        assert end.isoformat() == "2026-11-23T19:00:00+00:00"
        return []

    monkeypatch.setattr(manager_service.repository, "get_manager", get_manager)
    monkeypatch.setattr(manager_service.repository, "list_schedule", list_schedule)
    assert asyncio.run(manager_service.get_schedule(None, 1, date(2026, 11, 23))).meetings == []
