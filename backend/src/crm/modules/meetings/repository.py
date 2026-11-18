from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import Conflict, NotFound
from crm.modules.meetings.models import Meeting, MeetingHistory
from crm.modules.meetings.schemas import HistoryRead, MeetingRead, MeetingSummary


@dataclass(frozen=True)
class HistoryState:
    starts_at: datetime
    ends_at: datetime
    manager_id: int
    status: str

    @classmethod
    def capture(cls, meeting: Meeting) -> "HistoryState":
        return cls(meeting.starts_at, meeting.ends_at, meeting.manager_id, meeting.status)


async def get_meeting(session: AsyncSession, meeting_id: int, *, lock: bool = False) -> Meeting:
    statement = select(Meeting).where(Meeting.id == meeting_id)
    if lock:
        statement = statement.with_for_update()
    meeting = await session.scalar(statement)
    if meeting is None:
        raise NotFound("Meeting not found")
    return meeting


async def check_availability(
    session: AsyncSession,
    company_id: int,
    manager_id: int,
    starts_at: datetime,
    ends_at: datetime,
    exclude_id: int | None = None,
) -> None:
    active = select(Meeting.id).where(Meeting.status == "scheduled")
    if exclude_id is not None:
        active = active.where(Meeting.id != exclude_id)
    if await session.scalar(active.where(Meeting.company_id == company_id).limit(1)):
        raise Conflict("Company already has an active meeting")
    if await session.scalar(
        active.where(
            Meeting.manager_id == manager_id,
            Meeting.starts_at < ends_at,
            Meeting.ends_at > starts_at,
        ).limit(1)
    ):
        raise Conflict("Manager already has a meeting in this time interval")


async def record_history(
    session: AsyncSession,
    meeting: Meeting,
    action: str,
    old: HistoryState | None = None,
) -> None:
    session.add(
        MeetingHistory(
            meeting_id=meeting.id,
            action=action,
            old_starts_at=old.starts_at if old else None,
            old_ends_at=old.ends_at if old else None,
            old_manager_id=old.manager_id if old else None,
            old_status=old.status if old else None,
            new_starts_at=meeting.starts_at,
            new_ends_at=meeting.ends_at,
            new_manager_id=meeting.manager_id,
            new_status=meeting.status,
        )
    )
    await session.flush()


async def read_meeting(session: AsyncSession, meeting: Meeting) -> MeetingRead:
    history = await session.scalars(
        select(MeetingHistory)
        .where(
            MeetingHistory.meeting_id == meeting.id,
        )
        .order_by(MeetingHistory.id)
    )
    return MeetingRead(
        **MeetingSummary.model_validate(meeting).model_dump(),
        history=[HistoryRead.model_validate(item) for item in history],
    )
