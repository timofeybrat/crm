from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import NotFound
from crm.modules.calls.models import Call
from crm.modules.companies.models import Company, CompanyStatus
from crm.modules.companies.schemas import CompanyCreate
from crm.modules.meetings.models import Meeting


async def get_company(session: AsyncSession, company_id: int, *, lock: bool = False) -> Company:
    statement = select(Company).where(Company.id == company_id)
    if lock:
        statement = statement.with_for_update()
    company = await session.scalar(statement)
    if company is None:
        raise NotFound("Company not found")
    return company


async def add_company(session: AsyncSession, data: CompanyCreate) -> Company:
    company = Company(**data.model_dump())
    session.add(company)
    await session.flush()
    return company


async def list_companies(
    session: AsyncSession,
    status: CompanyStatus | None,
    limit: int,
    offset: int,
    search: str = "",
) -> tuple[list[Company], int]:
    statement = select(Company)
    count = select(func.count()).select_from(Company)
    if status is not None:
        statement = statement.where(Company.status == status)
        count = count.where(Company.status == status)
    if search.strip():
        escaped = search.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        condition = or_(
            Company.name.ilike(pattern, escape="\\"),
            Company.bin.ilike(pattern, escape="\\"),
            Company.phone.ilike(pattern, escape="\\"),
        )
        statement, count = statement.where(condition), count.where(condition)
    total = await session.scalar(count)
    items = await session.scalars(statement.order_by(Company.id).limit(limit).offset(offset))
    return list(items), total or 0


async def get_activity(
    session: AsyncSession,
    company_id: int,
) -> tuple[Meeting | None, list[Meeting], list[Call]]:
    active = await session.scalar(
        select(Meeting).where(
            Meeting.company_id == company_id,
            Meeting.status == "scheduled",
        )
    )
    meetings = list(
        await session.scalars(
            select(Meeting)
            .where(
                Meeting.company_id == company_id,
            )
            .order_by(Meeting.id.desc())
            .limit(10)
        )
    )
    calls = list(
        await session.scalars(
            select(Call)
            .where(
                Call.company_id == company_id,
            )
            .order_by(Call.id.desc())
            .limit(10)
        )
    )
    return active, meetings, calls
