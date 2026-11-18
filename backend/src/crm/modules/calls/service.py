from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import InvalidOperation
from crm.db.transactions import transaction
from crm.modules.calls import repository
from crm.modules.calls.schemas import CallCreate, CallRead
from crm.modules.companies.repository import get_company
from crm.modules.meetings.repository import get_meeting


async def record_call(session: AsyncSession, data: CallCreate) -> CallRead:
    async with transaction(session):
        if data.meeting_id is not None:
            # Lock before the company: prevents cancellation during link validation.
            meeting = await get_meeting(session, data.meeting_id, lock=True)
            if meeting.company_id != data.company_id:
                raise InvalidOperation("Meeting belongs to another company")
            if meeting.status != "scheduled":
                raise InvalidOperation("meeting_set requires a scheduled meeting")
        company = await get_company(session, data.company_id, lock=True)
        company.status = data.result
        call = await repository.add_call(session, data)
        response = CallRead.model_validate(call)
    return response
