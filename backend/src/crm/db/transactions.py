from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.exc import DBAPIError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import Conflict

CONFLICTS = {
    "uq_companies_bin": "Company with this BIN already exists",
    "uq_meetings_active_company": "Company already has an active meeting",
    "ex_meetings_manager_overlap": "Manager already has a meeting in this time interval",
}


@asynccontextmanager
async def transaction(session: AsyncSession) -> AsyncIterator[None]:
    """Rollback before translating known database conflicts; do not mask other failures."""
    try:
        async with session.begin():
            yield
    except IntegrityError as exc:
        cause = exc.orig.__cause__
        constraint = getattr(cause, "constraint_name", None)
        if constraint in CONFLICTS:
            raise Conflict(CONFLICTS[constraint]) from exc
        raise
    except DBAPIError as exc:
        state = getattr(exc.orig, "sqlstate", None)
        if state in {"40P01", "40001"}:
            # PostgreSQL has already selected an aborted transaction. The context
            # rolls it back completely; the caller may safely retry the operation.
            raise Conflict("Concurrent update conflict; retry the request") from exc
        raise
