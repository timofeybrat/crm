from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.errors import NotFound
from crm.modules.companies.models import Company, CompanyStatus
from crm.modules.companies.schemas import CompanyCreate


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
) -> tuple[list[Company], int]:
    statement = select(Company)
    count = select(func.count()).select_from(Company)
    if status is not None:
        statement = statement.where(Company.status == status)
        count = count.where(Company.status == status)
    total = await session.scalar(count)
    items = await session.scalars(statement.order_by(Company.id).limit(limit).offset(offset))
    return list(items), total or 0
