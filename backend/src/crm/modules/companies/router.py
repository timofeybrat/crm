from typing import Annotated

from fastapi import APIRouter, Query

from crm.api.dependencies import SessionDep
from crm.modules.companies import service
from crm.modules.companies.models import CompanyStatus
from crm.modules.companies.schemas import CompanyCreate, CompanyPage, CompanyRead

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
) -> CompanyPage:
    return await service.list_companies(session, status, limit, offset)
