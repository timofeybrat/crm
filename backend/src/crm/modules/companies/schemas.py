from datetime import datetime
from typing import Annotated

from pydantic import Field

from crm.api.schemas import ApiModel
from crm.modules.calls.schemas import CallRead
from crm.modules.companies.models import CompanyStatus
from crm.modules.meetings.schemas import MeetingSummary


class CompanyCreate(ApiModel):
    name: Annotated[str, Field(min_length=1, max_length=200)]
    bin: Annotated[str, Field(pattern=r"^[0-9]{12}$")]
    phone: Annotated[str, Field(min_length=5, max_length=32)]


class CompanyRead(CompanyCreate):
    id: int
    status: CompanyStatus
    created_at: datetime


class CompanyPage(ApiModel):
    items: list[CompanyRead]
    total: int
    limit: int
    offset: int


class CompanyDetail(CompanyRead):
    active_meeting: MeetingSummary | None
    recent_meetings: list[MeetingSummary]
    recent_calls: list[CallRead]
