from datetime import datetime
from typing import Self

from pydantic import PositiveInt, model_validator

from crm.api.schemas import ApiModel
from crm.modules.calls.models import CallResult


class CallCreate(ApiModel):
    company_id: PositiveInt
    result: CallResult
    meeting_id: PositiveInt | None = None

    @model_validator(mode="after")
    def validate_meeting_link(self) -> Self:
        if self.result == CallResult.MEETING_SET and self.meeting_id is None:
            raise ValueError("meeting_set requires meeting_id of an existing meeting")
        if self.result != CallResult.MEETING_SET and self.meeting_id is not None:
            raise ValueError("meeting_id is only allowed for meeting_set")
        return self


class CallRead(CallCreate):
    id: int
    created_at: datetime
