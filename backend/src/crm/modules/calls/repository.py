from sqlalchemy.ext.asyncio import AsyncSession

from crm.modules.calls.models import Call
from crm.modules.calls.schemas import CallCreate


async def add_call(session: AsyncSession, data: CallCreate) -> Call:
    call = Call(**data.model_dump())
    session.add(call)
    await session.flush()
    return call
