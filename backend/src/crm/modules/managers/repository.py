from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import NotFound
from crm.modules.managers.models import Manager


async def get_manager(session: AsyncSession, manager_id: int) -> Manager:
    manager = await session.get(Manager, manager_id)
    if manager is None:
        raise NotFound("Manager not found")
    return manager


async def list_managers(session: AsyncSession) -> list[Manager]:
    return list(await session.scalars(select(Manager).order_by(Manager.id)))
