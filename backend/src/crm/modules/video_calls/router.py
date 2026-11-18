from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import PositiveInt

from crm.api.dependencies import SessionDep
from crm.modules.auth.rate_limit import client_address, consume
from crm.modules.auth.sessions import UserDep
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


@router.get("/meetings/{meeting_id}", response_model=RoomRead)
async def get_room(meeting_id: PositiveInt, session: SessionDep, user: UserDep):
    return await service.manager_room(
        session, meeting_id, user.manager_id, admin=user.role == "admin"
    )


@router.post("/meetings/{meeting_id}/room", response_model=RoomRead)
async def create_room(meeting_id: PositiveInt, session: SessionDep, user: UserDep):
    return await service.manager_room(
        session, meeting_id, user.manager_id, create=True, admin=user.role == "admin"
    )


@router.post("/meetings/{meeting_id}/invitation", response_model=InvitationRead)
async def invite(meeting_id: PositiveInt, session: SessionDep, user: UserDep, request: Request):
    return await service.issue_invitation(
        session, meeting_id, user.manager_id, request.app.state.settings, admin=user.role == "admin"
    )


@router.post("/meetings/{meeting_id}/join", response_model=ConnectionRead)
async def manager_join(
    meeting_id: PositiveInt,
    data: JoinRequest,
    session: SessionDep,
    user: UserDep,
    request: Request,
):
    return await service.connect(
        session,
        request.app.state.video_gateway,
        request.app.state.settings,
        data.name,
        meeting_id=meeting_id,
        manager_id=user.manager_id,
        admin=user.role == "admin",
        host_session_hash=user.session_hash,
    )


@router.post("/meetings/{meeting_id}/close", status_code=204)
async def close(meeting_id: PositiveInt, session: SessionDep, user: UserDep):
    await service.close_room(session, meeting_id, user.manager_id, admin=user.role == "admin")


@router.post("/guest", response_model=RoomRead)
async def guest(data: GuestRequest, session: SessionDep, request: Request):
    await consume(request, [("video-guest", client_address(request), 60, 60)])
    return await service.guest_room(session, data.invitation.get_secret_value())


@router.post("/guest/join", response_model=ConnectionRead)
async def guest_join(data: GuestJoin, session: SessionDep, request: Request):
    await consume(request, [("video-join", client_address(request), 20, 60)])
    return await service.connect(
        session,
        request.app.state.video_gateway,
        request.app.state.settings,
        data.name,
        invitation=data.invitation.get_secret_value(),
    )
