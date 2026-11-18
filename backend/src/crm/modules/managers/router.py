from datetime import date as Date

from fastapi import APIRouter
from pydantic import PositiveInt

from crm.api.dependencies import SessionDep
from crm.modules.managers import service
from crm.modules.managers.schemas import ManagerRead, ScheduleRead

router = APIRouter(prefix="/managers", tags=["managers"])


@router.get("", response_model=list[ManagerRead])
async def list_managers(session: SessionDep) -> list[ManagerRead]:
    return await service.list_managers(session)


@router.get("/{manager_id}/schedule", response_model=ScheduleRead)
async def get_schedule(manager_id: PositiveInt, date: Date, session: SessionDep) -> ScheduleRead:
    return await service.get_schedule(session, manager_id, date)
