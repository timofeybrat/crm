from fastapi import APIRouter

from crm.api.dependencies import SessionDep
from crm.modules.meetings import service
from crm.modules.meetings.schemas import MeetingCreate, MeetingRead

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.post("", response_model=MeetingRead, status_code=201)
async def create_meeting(data: MeetingCreate, session: SessionDep) -> MeetingRead:
    return await service.create_meeting(session, data)
