from datetime import UTC, datetime, time, timedelta
from typing import Annotated
from zoneinfo import ZoneInfo

from pydantic import AfterValidator, AwareDatetime, BeforeValidator

from crm.core.errors import InvalidOperation

ALMATY = ZoneInfo("Asia/Almaty")
DURATION = timedelta(minutes=60)


def require_iso_datetime(value):
    if not isinstance(value, (str, datetime)):
        raise ValueError("Use an ISO 8601 UTC datetime")
    return value


def require_utc(value: datetime) -> datetime:
    if value.utcoffset() != timedelta(0):
        raise ValueError("Datetime must use UTC (Z or +00:00)")
    return value.astimezone(UTC)


UtcDateTime = Annotated[
    AwareDatetime,
    BeforeValidator(require_iso_datetime),
    AfterValidator(require_utc),
]


def meeting_end(starts_at: datetime) -> datetime:
    local_start = starts_at.astimezone(ALMATY)
    local_end = local_start + DURATION
    if (
        local_start.weekday() >= 5
        or local_start.time() < time(9)
        or local_end.date() != local_start.date()
        or local_end.time() > time(18)
    ):
        raise InvalidOperation("Meeting must fit Mon-Fri 09:00-18:00 Asia/Almaty (60 minutes)")
    return starts_at + DURATION
