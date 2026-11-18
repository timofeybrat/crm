import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.core.errors import Conflict
from crm.db.transactions import transaction


def test_real_postgres_deadlock_is_rolled_back_and_translated_to_conflict(db, test_database_url):
    db(
        "INSERT INTO companies (name, bin, phone) VALUES "
        "('Deadlock A', '000000000001', '00000'), ('Deadlock B', '000000000002', '00000')"
    )

    async def race():
        engine = create_async_engine(test_database_url, hide_parameters=True)
        barrier = asyncio.Barrier(2)
        factory = async_sessionmaker(engine)

        async def lock(first, second):
            async with factory() as session, transaction(session):
                await session.execute(
                    text("SELECT id FROM companies WHERE id=:id FOR UPDATE"), {"id": first}
                )
                await barrier.wait()
                await session.execute(
                    text("SELECT id FROM companies WHERE id=:id FOR UPDATE"), {"id": second}
                )

        try:
            results = await asyncio.gather(lock(1, 2), lock(2, 1), return_exceptions=True)
            assert sum(result is None for result in results) == 1
            assert sum(isinstance(result, Conflict) for result in results) == 1
        finally:
            await engine.dispose()

    asyncio.run(race())
