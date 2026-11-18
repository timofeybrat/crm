from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from crm.modules.auth.models import ManagerAccount
from crm.modules.auth.passwords import DUMMY_HASH, verify_password


async def authenticate_account(session: AsyncSession, login: str, password: str) -> ManagerAccount:
    """Caller owns transaction; locking serializes login with password changes."""
    account = await session.scalar(
        select(ManagerAccount).where(ManagerAccount.login == login.lower()).with_for_update()
    )
    valid, updated_hash = await run_in_threadpool(
        verify_password, password, account.password_hash if account else DUMMY_HASH
    )
    if not valid or account is None or not account.enabled:
        raise HTTPException(401, "Invalid login or password")
    if updated_hash:
        account.password_hash = updated_hash
    return account
