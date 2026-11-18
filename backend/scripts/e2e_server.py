"""Disposable browser-test server. Resets ONLY the explicitly configured crm_test database."""

import asyncio
import os
from pathlib import Path

import uvicorn
from alembic.config import Config
from dotenv import dotenv_values
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command

backend = Path(__file__).resolve().parents[1]
url = os.getenv("CRM_TEST_DATABASE_URL") or dotenv_values(backend / ".env.test").get(
    "CRM_TEST_DATABASE_URL"
)
if not url or make_url(url).database != "crm_test":
    raise SystemExit("Configure .env.test with CRM_TEST_DATABASE_URL pointing to crm_test")
os.environ["CRM_DATABASE_URL"] = url
command.upgrade(Config(str(backend / "alembic.ini")), "head")


async def prepare() -> None:
    engine = create_async_engine(url)
    try:
        async with engine.begin() as connection:
            await connection.execute(
                text(
                    "TRUNCATE video_cleanup, calls, meeting_history, meetings, companies, managers "
                    "RESTART IDENTITY CASCADE"
                )
            )
            await connection.execute(
                text(
                    "INSERT INTO managers (id, name) VALUES "
                    "(1, 'Demo manager 1'), (2, 'Demo manager 2')"
                )
            )
    finally:
        await engine.dispose()


asyncio.run(prepare())

from crm.core.config import Settings  # noqa: E402
from crm.main import create_app  # noqa: E402

uvicorn.run(create_app(Settings(database_url=url, debug=False)), host="127.0.0.1", port=18001)
