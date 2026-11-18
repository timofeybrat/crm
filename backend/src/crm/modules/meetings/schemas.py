from datetime import datetime
from typing import Annotated, Literal

from pydantic import Field, PositiveInt

from crm.api.schemas import ApiModel
from crm.modules.meetings.models import MeetingStatus
from crm.modules.meetings.rules import UtcDateTime


class MeetingCreate(ApiModel):
    company_id: PositiveInt
    manager_id: PositiveInt
    starts_at: UtcDateTime


class HistoryRead(ApiModel):
    id: int
    action: str
    old_starts_at: datetime | None
    old_ends_at: datetime | None
    old_manager_id: int | None
    old_status: str | None
    new_starts_at: datetime
    new_ends_at: datetime
    new_manager_id: int
    new_status: str
    occurred_at: datetime


class MeetingSummary(ApiModel):
    id: int
    company_id: int
    manager_id: int
    starts_at: datetime
    ends_at: datetime
    original_starts_at: datetime
    created_at: datetime
    status: MeetingStatus


class MeetingRead(MeetingSummary):
    history: list[HistoryRead]


class RescheduleMeeting(ApiModel):
    action: Literal["reschedule"]
    starts_at: UtcDateTime
    manager_id: PositiveInt | None = None


class CancelMeeting(ApiModel):
    action: Literal["cancel"]


class CompleteMeeting(ApiModel):
    action: Literal["complete"]


MeetingPatch = Annotated[
    RescheduleMeeting | CancelMeeting | CompleteMeeting,
    Field(discriminator="action"),
]
