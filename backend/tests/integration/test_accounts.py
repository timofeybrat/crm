import asyncio

import pytest
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.modules.auth.accounts import authenticate_account
from crm.modules.auth.passwords import hash_password


def test_credentials_case_insensitive_and_generic_failures(db, test_database_url):
    db(
        "INSERT INTO manager_accounts (manager_id, login, password_hash) VALUES (1, 'manager1', :hash)",
        {"hash": hash_password("public-test-password-only")},
    )

    async def verify(login, password):
        engine = create_async_engine(test_database_url)
        try:
            async with async_sessionmaker(engine)() as session, session.begin():
                account = await authenticate_account(session, login, password)
                return account.manager_id
        finally:
            await engine.dispose()

    assert asyncio.run(verify("MANAGER1", "public-test-password-only")) == 1
    for login, password in [("manager1", "wrong"), ("unknown", "wrong")]:
        with pytest.raises(HTTPException, match="Invalid login or password") as error:
            asyncio.run(verify(login, password))
        assert error.value.status_code == 401
    db("UPDATE manager_accounts SET enabled = false")
    with pytest.raises(HTTPException, match="Invalid login or password"):
        asyncio.run(verify("manager1", "public-test-password-only"))
