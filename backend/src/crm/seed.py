"""Idempotent demo managers. Run: uv run python -m crm.seed (PYTHONPATH=src)."""

import asyncio

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import create_async_engine

from crm.core.config import get_settings
from crm.modules.managers.models import Manager


async def seed() -> None:
    engine = create_async_engine(get_settings().database_url)
    try:
        async with engine.begin() as connection:
            await connection.execute(
                insert(Manager)
                .values(
                    [
                        {"id": 1, "name": "Demo manager 1"},
                        {"id": 2, "name": "Demo manager 2"},
                    ]
                )
                .on_conflict_do_nothing(index_elements=[Manager.id])
            )
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
