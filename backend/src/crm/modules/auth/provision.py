"""Operator-only account provisioning. Password input is hidden; never use a CLI argument."""

import argparse
import asyncio
import getpass
import re

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.core.config import get_settings
from crm.modules.auth.models import AuthSession, ManagerAccount
from crm.modules.auth.passwords import hash_password
from crm.modules.managers.models import Manager


async def provision(manager_id: int, login: str, password: str, role: str):
    encoded = await asyncio.to_thread(hash_password, password)
    engine = create_async_engine(get_settings().database_url, hide_parameters=True)
    try:
        async with async_sessionmaker(engine)() as session, session.begin():
            if await session.get(Manager, manager_id) is None:
                raise ValueError("Manager does not exist; run crm.seed or choose an existing ID")
            account = await session.scalar(
                select(ManagerAccount)
                .where(ManagerAccount.manager_id == manager_id)
                .with_for_update()
            )
            duplicate = await session.scalar(
                select(ManagerAccount).where(ManagerAccount.login == login)
            )
            if duplicate and duplicate != account:
                raise ValueError("Login is already assigned to another manager")
            if account:
                await session.execute(
                    delete(AuthSession).where(AuthSession.account_id == account.id)
                )
                account.login, account.password_hash, account.role = login, encoded, role
                account.enabled = True
            else:
                session.add(
                    ManagerAccount(
                        manager_id=manager_id,
                        login=login,
                        password_hash=encoded,
                        role=role,
                    )
                )
    finally:
        await engine.dispose()


async def disable(manager_id: int):
    engine = create_async_engine(get_settings().database_url, hide_parameters=True)
    try:
        async with async_sessionmaker(engine)() as session, session.begin():
            account = await session.scalar(
                select(ManagerAccount)
                .where(ManagerAccount.manager_id == manager_id)
                .with_for_update()
            )
            if account is None:
                raise ValueError("Manager account not found")
            account.enabled = False
            await session.execute(delete(AuthSession).where(AuthSession.account_id == account.id))
    finally:
        await engine.dispose()


def main():
    parser = argparse.ArgumentParser(description="Create or reset a manager account")
    parser.add_argument("--manager-id", type=int)
    parser.add_argument("--login")
    parser.add_argument("--role", choices=["manager", "admin"], default="manager")
    parser.add_argument("--from-env", action="store_true")
    parser.add_argument("--disable", action="store_true")
    args = parser.parse_args()
    settings = get_settings()
    manager_id = args.manager_id or settings.bootstrap_manager_id
    if args.disable:
        asyncio.run(disable(manager_id))
        print("Manager account disabled; its sessions revoked.")
        return
    login = (args.login or settings.bootstrap_login).strip().lower()
    if not re.fullmatch(r"[a-z0-9._@-]{3,64}", login) or manager_id <= 0:
        parser.error("Choose a valid manager ID and login (3-64 ASCII characters)")
    password = (
        settings.bootstrap_password.get_secret_value()
        if args.from_env
        else getpass.getpass("New password (12-128 characters): ")
    )
    if not 12 <= len(password) <= 128:
        parser.error("Password must contain 12 to 128 characters")
    asyncio.run(provision(manager_id, login, password, args.role))
    print("Manager account saved. Password is not printed.")


if __name__ == "__main__":
    main()
