from sqlalchemy.ext.asyncio import AsyncSession

from crm.db.transactions import transaction
from crm.modules.companies import repository
from crm.modules.companies.models import CompanyStatus
from crm.modules.companies.schemas import CompanyCreate, CompanyPage, CompanyRead


async def create_company(session: AsyncSession, data: CompanyCreate) -> CompanyRead:
    async with transaction(session):
        company = await repository.add_company(session, data)
        response = CompanyRead.model_validate(company)
    return response


async def list_companies(
    session: AsyncSession,
    status: CompanyStatus | None,
    limit: int,
    offset: int,
) -> CompanyPage:
    items, total = await repository.list_companies(session, status, limit, offset)
    return CompanyPage(items=items, total=total, limit=limit, offset=offset)
