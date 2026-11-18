from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import InvalidOperation
from crm.db.transactions import transaction
from crm.modules.companies.repository import get_company
from crm.modules.managers.repository import get_manager
from crm.modules.meetings import repository
from crm.modules.meetings.models import Meeting
from crm.modules.meetings.rules import meeting_end
from crm.modules.meetings.schemas import MeetingCreate, MeetingPatch, MeetingRead
from crm.modules.video_calls.service import invalidate_for_meeting


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


async def get_meeting(session: AsyncSession, meeting_id: int) -> MeetingRead:
    return await repository.read_meeting(session, await repository.get_meeting(session, meeting_id))


async def update_meeting(
    session: AsyncSession,
    meeting_id: int,
    data: MeetingPatch,
) -> MeetingRead:
    async with transaction(session):
        meeting = await repository.get_meeting(session, meeting_id, lock=True)
        target = {"cancel": "cancelled", "complete": "completed"}.get(data.action)
        if target == meeting.status:
            return await repository.read_meeting(session, meeting)
        if meeting.status != "scheduled":
            raise InvalidOperation("Only a scheduled meeting can be changed")
        previous = repository.HistoryState.capture(meeting)
        if data.action == "reschedule":
            ends_at = meeting_end(data.starts_at)
            manager_id = data.manager_id if data.manager_id is not None else meeting.manager_id
            await get_manager(session, manager_id)
            await repository.check_availability(
                session,
                meeting.company_id,
                manager_id,
                data.starts_at,
                ends_at,
                exclude_id=meeting.id,
            )
            meeting.starts_at, meeting.ends_at = data.starts_at, ends_at
            meeting.manager_id = manager_id
        else:
            if data.action == "complete" and meeting.ends_at > datetime.now(UTC):
                raise InvalidOperation("Meeting cannot be completed before it ends")
            meeting.status = target
        await invalidate_for_meeting(session, meeting.id, reschedule=data.action == "reschedule")
        await session.flush()
        await repository.record_history(session, meeting, data.action, previous)
        response = await repository.read_meeting(session, meeting)
    return response
