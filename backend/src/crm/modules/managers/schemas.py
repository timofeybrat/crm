from datetime import date

from crm.api.schemas import ApiModel
from crm.modules.meetings.schemas import MeetingSummary


class ManagerRead(ApiModel):
    id: int
    name: str


class ScheduledMeeting(MeetingSummary):
    company_name: str


class ScheduleRead(ApiModel):
    manager_id: int
    date: date
    meetings: list[ScheduledMeeting]
