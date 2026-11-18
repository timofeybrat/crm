from sqlalchemy.ext.asyncio import AsyncSession

from crm.db.transactions import transaction
from crm.modules.companies.repository import get_company
from crm.modules.managers.repository import get_manager
from crm.modules.meetings import repository
from crm.modules.meetings.models import Meeting
from crm.modules.meetings.rules import meeting_end
from crm.modules.meetings.schemas import MeetingCreate, MeetingRead


async def create_meeting(session: AsyncSession, data: MeetingCreate) -> MeetingRead:
    ends_at = meeting_end(data.starts_at)
    async with transaction(session):
        await get_company(session, data.company_id)
        await get_manager(session, data.manager_id)
        await repository.check_availability(
            session,
            data.company_id,
            data.manager_id,
            data.starts_at,
            ends_at,
        )
        meeting = Meeting(
            **data.model_dump(),
            ends_at=ends_at,
            original_starts_at=data.starts_at,
        )
        session.add(meeting)
        await session.flush()
        await repository.record_history(session, meeting, "create")
        response = await repository.read_meeting(session, meeting)
    return response
