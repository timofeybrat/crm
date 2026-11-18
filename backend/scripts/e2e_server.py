"""Disposable browser-test server. Resets ONLY the explicitly configured crm_test database."""

import asyncio
import os
from pathlib import Path

import uvicorn
from alembic.config import Config
from dotenv import dotenv_values
from pydantic import SecretStr
from sqlalchemy import text
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import create_async_engine

from alembic import command
from crm.modules.auth.passwords import hash_password

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
                    "TRUNCATE auth_rate_buckets, video_cleanup, calls, meeting_history, "
                    "meetings, companies, managers "
                    "RESTART IDENTITY CASCADE"
                )
            )
            await connection.execute(
                text(
                    "INSERT INTO managers (id, name) VALUES "
                    "(1, 'Demo manager 1'), (2, 'Demo manager 2')"
                )
            )
            if os.getenv("CRM_E2E_VIDEO") == "1":
                await connection.execute(
                    text(
                        "INSERT INTO companies (id, name, bin, phone) "
                        "VALUES (90001, 'Video E2E company', '000000090001', '+70000000001')"
                    )
                )
                await connection.execute(
                    text(
                        "INSERT INTO meetings (id, company_id, manager_id, starts_at, ends_at, "
                        "original_starts_at) VALUES (90001, 90001, 1, "
                        "now() - interval '5 minutes', "
                        "now() + interval '55 minutes', now() - interval '5 minutes')"
                    )
                )
            for manager_id, role in [(1, "admin"), (2, "manager")]:
                await connection.execute(
                    text(
                        "INSERT INTO manager_accounts (manager_id, login, password_hash, role) "
                        "VALUES (:id, :login, :hash, :role)"
                    ),
                    {
                        "id": manager_id,
                        "login": f"manager{manager_id}",
                        "hash": hash_password("public-test-password-only"),
                        "role": role,
                    },
                )
    finally:
        await engine.dispose()


asyncio.run(prepare())

from crm.core.config import Settings  # noqa: E402
from crm.main import create_app  # noqa: E402

video = os.getenv("CRM_E2E_VIDEO") == "1"
settings = Settings(
    database_url=url,
    debug=False,
    video_enabled=video,
    livekit_url="http://localhost:17880",
    livekit_public_url="wss://localhost:18444"
    if os.getenv("CRM_E2E_HTTPS") == "1"
    else "ws://localhost:17880",
    livekit_api_key=SecretStr("crm-e2e"),
    livekit_api_secret=SecretStr("test-video-secret-for-disposable-local-e2e-only"),
    frontend_url="https://localhost:18443"
    if os.getenv("CRM_E2E_HTTPS") == "1"
    else "http://127.0.0.1:3001",
    session_cookie_secure=os.getenv("CRM_E2E_HTTPS") == "1",
)
uvicorn.run(create_app(settings), host="127.0.0.1", port=18001)
