from collections.abc import AsyncIterator

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    """One session per request. Services own transaction commit/rollback boundaries."""
    async with request.app.state.session_factory() as session:
        yield session
