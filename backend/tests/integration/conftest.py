import asyncio
import os
import subprocess
import sys
from pathlib import Path

import pytest
from dotenv import dotenv_values
from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from crm.core.config import Settings
from crm.main import create_app


async def execute_sql(url: str, statement: str, params: dict | None = None):
    engine = create_async_engine(url)
    try:
        async with engine.begin() as connection:
            result = await connection.execute(text(statement), params or {})
            return result.mappings().all() if result.returns_rows else []
    finally:
        await engine.dispose()


@pytest.fixture(scope="session")
def test_database_url():
    backend = Path(__file__).resolve().parents[2]
    url = os.getenv("CRM_TEST_DATABASE_URL") or dotenv_values(backend / ".env.test").get(
        "CRM_TEST_DATABASE_URL"
    )
    if not url:
        pytest.skip("Set CRM_TEST_DATABASE_URL or copy .env.test.example to .env.test")
    if make_url(url).database != "crm_test":
        raise RuntimeError("Integration tests may only reset the crm_test database")
    env = {**os.environ, "CRM_DATABASE_URL": url}
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=backend,
        env=env,
        check=True,
        capture_output=True,
    )
    return url


@pytest.fixture
def client(db, test_database_url):
    with TestClient(create_app(Settings(database_url=test_database_url))) as client:
        yield client


@pytest.fixture
def db(test_database_url):
    def execute(statement, params=None):
        return asyncio.run(execute_sql(test_database_url, statement, params))

    execute(
        "TRUNCATE video_cleanup, calls, meeting_history, meetings, companies, managers "
        "RESTART IDENTITY CASCADE"
    )
    execute("INSERT INTO managers (id, name) VALUES (1, 'Demo 1'), (2, 'Demo 2')")
    yield execute
    execute(
        "TRUNCATE video_cleanup, calls, meeting_history, meetings, companies, managers "
        "RESTART IDENTITY CASCADE"
    )
