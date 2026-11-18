from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import NotFound
from crm.modules.managers.models import Manager
from crm.modules.meetings.models import Meeting


async def get_manager(session: AsyncSession, manager_id: int) -> Manager:
    manager = await session.get(Manager, manager_id)
    if manager is None:
        raise NotFound("Manager not found")
    return manager


async def list_managers(session: AsyncSession) -> list[Manager]:
    return list(await session.scalars(select(Manager).order_by(Manager.id)))


async def list_schedule(
    session: AsyncSession,
    manager_id: int,
    starts_at: datetime,
    ends_at: datetime,
) -> list[Meeting]:
    return list(
        await session.scalars(
            select(Meeting)
            .where(
                Meeting.manager_id == manager_id,
                Meeting.status == "scheduled",
                Meeting.starts_at >= starts_at,
                Meeting.starts_at < ends_at,
            )
            .order_by(Meeting.starts_at, Meeting.id)
        )
    )
