from typing import Annotated

from fastapi import APIRouter, Query
from pydantic import PositiveInt

from crm.api.dependencies import SessionDep
from crm.modules.companies import service
from crm.modules.companies.models import CompanyStatus
from crm.modules.companies.schemas import CompanyCreate, CompanyDetail, CompanyPage, CompanyRead

router = APIRouter(prefix="/companies", tags=["companies"])


@router.post("", response_model=CompanyRead, status_code=201)
async def create_company(data: CompanyCreate, session: SessionDep) -> CompanyRead:
    return await service.create_company(session, data)


@router.get("", response_model=CompanyPage)
async def list_companies(
    session: SessionDep,
    status: CompanyStatus | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    search: Annotated[str, Query(max_length=200)] = "",
) -> CompanyPage:
    return await service.list_companies(session, status, limit, offset, search)


@router.get("/{company_id}", response_model=CompanyDetail)
async def get_company(company_id: PositiveInt, session: SessionDep) -> CompanyDetail:
    return await service.get_company_detail(session, company_id)
