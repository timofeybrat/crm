from datetime import UTC, date, datetime, time, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import InvalidOperation
from crm.modules.managers import repository
from crm.modules.managers.schemas import ManagerRead, ScheduleRead
from crm.modules.meetings.rules import ALMATY


async def list_managers(session: AsyncSession) -> list[ManagerRead]:
    return [ManagerRead.model_validate(item) for item in await repository.list_managers(session)]


async def get_schedule(
    session: AsyncSession,
    manager_id: int,
    day: date,
) -> ScheduleRead:
    await repository.get_manager(session, manager_id)
    if day in (date.min, date.max):
        raise InvalidOperation("Schedule date is outside the supported UTC conversion range")
    local_start = datetime.combine(day, time.min, tzinfo=ALMATY)
    local_end = local_start + timedelta(days=1)
    meetings = await repository.list_schedule(
        session,
        manager_id,
        local_start.astimezone(UTC),
        local_end.astimezone(UTC),
    )
    return ScheduleRead(manager_id=manager_id, date=day, meetings=meetings)
