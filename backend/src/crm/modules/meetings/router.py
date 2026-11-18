from fastapi import APIRouter
from pydantic import PositiveInt

from crm.api.dependencies import SessionDep
from crm.modules.auth.sessions import UserDep
from crm.modules.meetings import service
from crm.modules.meetings.schemas import MeetingCreate, MeetingPatch, MeetingRead

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.post("", response_model=MeetingRead, status_code=201)
async def create_meeting(data: MeetingCreate, session: SessionDep, user: UserDep) -> MeetingRead:
    return await service.create_meeting(session, data, user)


@router.get("/{meeting_id}", response_model=MeetingRead)
async def get_meeting(meeting_id: PositiveInt, session: SessionDep) -> MeetingRead:
    return await service.get_meeting(session, meeting_id)


@router.patch("/{meeting_id}", response_model=MeetingRead)
async def update_meeting(
    meeting_id: PositiveInt,
    data: MeetingPatch,
    session: SessionDep,
    user: UserDep,
) -> MeetingRead:
    return await service.update_meeting(session, meeting_id, data, user)
