from sqlalchemy.ext.asyncio import AsyncSession

from crm.db.transactions import transaction
from crm.modules.companies import repository
from crm.modules.companies.models import CompanyStatus
from crm.modules.companies.schemas import CompanyCreate, CompanyDetail, CompanyPage, CompanyRead


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
    search: str = "",
) -> CompanyPage:
    items, total = await repository.list_companies(session, status, limit, offset, search)
    return CompanyPage(items=items, total=total, limit=limit, offset=offset)


async def get_company_detail(session: AsyncSession, company_id: int) -> CompanyDetail:
    company = await repository.get_company(session, company_id)
    active, meetings, calls = await repository.get_activity(session, company_id)
    return CompanyDetail(
        **CompanyRead.model_validate(company).model_dump(),
        active_meeting=active,
        recent_meetings=meetings,
        recent_calls=calls,
    )
