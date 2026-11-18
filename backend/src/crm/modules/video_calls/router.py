import secrets
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import PositiveInt

from crm.api.dependencies import SessionDep
from crm.modules.video_calls import service
from crm.modules.video_calls.schemas import (
    ConnectionRead,
    GuestJoin,
    GuestRequest,
    InvitationRead,
    JoinRequest,
    RoomRead,
)


def video_enabled(request: Request, response: Response):
    response.headers["Cache-Control"] = "no-store"
    if not request.app.state.settings.video_enabled:
        raise HTTPException(503, "Video calls are disabled")


router = APIRouter(prefix="/video", tags=["video"], dependencies=[Depends(video_enabled)])
bearer = HTTPBearer(auto_error=False)


def manager_identity(
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> int:
    if credentials:
        for manager_id, key in request.app.state.settings.video_manager_keys.items():
            if secrets.compare_digest(
                credentials.credentials.encode(), key.get_secret_value().encode()
            ):
                return manager_id
    raise HTTPException(401, "Invalid manager key", headers={"WWW-Authenticate": "Bearer"})


ManagerDep = Annotated[int, Depends(manager_identity)]


@router.get("/meetings/{meeting_id}", response_model=RoomRead)
async def get_room(meeting_id: PositiveInt, session: SessionDep, manager: ManagerDep):
    return await service.manager_room(session, meeting_id, manager)


@router.post("/meetings/{meeting_id}/room", response_model=RoomRead)
async def create_room(meeting_id: PositiveInt, session: SessionDep, manager: ManagerDep):
    return await service.manager_room(session, meeting_id, manager, create=True)


@router.post("/meetings/{meeting_id}/invitation", response_model=InvitationRead)
async def invite(
    meeting_id: PositiveInt, session: SessionDep, manager: ManagerDep, request: Request
):
    return await service.issue_invitation(session, meeting_id, manager, request.app.state.settings)


@router.post("/meetings/{meeting_id}/join", response_model=ConnectionRead)
async def manager_join(
    meeting_id: PositiveInt,
    data: JoinRequest,
    session: SessionDep,
    manager: ManagerDep,
    request: Request,
):
    return await service.connect(
        session,
        request.app.state.video_gateway,
        request.app.state.settings,
        data.name,
        meeting_id=meeting_id,
        manager_id=manager,
    )


@router.post("/meetings/{meeting_id}/close", status_code=204)
async def close(meeting_id: PositiveInt, session: SessionDep, manager: ManagerDep):
    await service.close_room(session, meeting_id, manager)


@router.post("/guest", response_model=RoomRead)
async def guest(data: GuestRequest, session: SessionDep):
    return await service.guest_room(session, data.invitation.get_secret_value())


@router.post("/guest/join", response_model=ConnectionRead)
async def guest_join(data: GuestJoin, session: SessionDep, request: Request):
    return await service.connect(
        session,
        request.app.state.video_gateway,
        request.app.state.settings,
        data.name,
        invitation=data.invitation.get_secret_value(),
    )
