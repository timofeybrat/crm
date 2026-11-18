from datetime import datetime

import pytest
from pydantic import ValidationError

from crm.core.errors import InvalidOperation
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
