from fastapi import APIRouter

from crm.api.dependencies import SessionDep
from crm.modules.calls import service
from crm.modules.calls.schemas import CallCreate, CallRead

router = APIRouter(prefix="/calls", tags=["calls"])


@router.post("", response_model=CallRead, status_code=201)
async def record_call(data: CallCreate, session: SessionDep) -> CallRead:
    return await service.record_call(session, data)
