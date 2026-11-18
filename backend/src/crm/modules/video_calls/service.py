import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from crm.core.config import Settings
from crm.core.errors import Conflict, NotFound
from crm.db.transactions import transaction
from crm.modules.companies.repository import get_company
from crm.modules.managers.repository import get_manager
from crm.modules.meetings.models import Meeting
from crm.modules.meetings.repository import get_meeting
from crm.modules.video_calls.gateway import LiveKitGateway
from crm.modules.video_calls.models import VideoCleanup, VideoRoom
from crm.modules.video_calls.schemas import ConnectionRead, InvitationRead, RoomRead


def invitation_hash(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def window(meeting: Meeting) -> tuple[datetime, datetime]:
    return meeting.starts_at - timedelta(minutes=15), meeting.ends_at + timedelta(minutes=15)


async def owned_meeting(session: AsyncSession, meeting_id: int, manager_id: int) -> Meeting:
    meeting = await get_meeting(session, meeting_id, lock=True)
    if meeting.manager_id != manager_id:
        raise HTTPException(403, "Video room belongs to another manager")
    return meeting


def check_active(meeting: Meeting, room: VideoRoom | None = None):
    if meeting.status != "scheduled" or (room and room.closed):
        raise Conflict("Video room is closed")
    if datetime.now(UTC) >= window(meeting)[1]:
        raise Conflict("Video access window has ended")


async def read_room(session: AsyncSession, meeting: Meeting) -> RoomRead:
    room = await session.get(VideoRoom, meeting.id)
    manager = await get_manager(session, meeting.manager_id)
    company = await get_company(session, meeting.company_id)
    opens_at, closes_at = window(meeting)
    return RoomRead(
        meeting_id=meeting.id,
        manager_name=manager.name,
        company_name=company.name,
        starts_at=meeting.starts_at,
        ends_at=meeting.ends_at,
        opens_at=opens_at,
        closes_at=closes_at,
        room_exists=room is not None,
        closed=meeting.status != "scheduled" or bool(room and room.closed),
    )


async def manager_room(session: AsyncSession, meeting_id: int, manager_id: int, create=False):
    async with transaction(session):
        meeting = await owned_meeting(session, meeting_id, manager_id)
        if create:
            room = await session.get(VideoRoom, meeting_id)
            check_active(meeting, room)
            if room is None:
                session.add(
                    VideoRoom(meeting_id=meeting_id, room_name=f"crm-{secrets.token_hex(20)}")
                )
                await session.flush()
        return await read_room(session, meeting)


async def issue_invitation(
    session: AsyncSession, meeting_id: int, manager_id: int, settings: Settings
):
    async with transaction(session):
        meeting = await owned_meeting(session, meeting_id, manager_id)
        room = await session.get(VideoRoom, meeting_id)
        check_active(meeting, room)
        if room is None:
            raise NotFound("Video room not found")
        # Only the digest persists. Issuing a new invitation invalidates the old one.
        invitation = secrets.token_urlsafe(32)
        room.invitation_hash = invitation_hash(invitation)
        return InvitationRead(
            url=f"{settings.frontend_url.rstrip('/')}/video/guest#invite={invitation}",
            expires_at=window(meeting)[1],
        )


async def guest_meeting(session: AsyncSession, invitation: str):
    digest = invitation_hash(invitation)
    meeting_id = await session.scalar(
        select(VideoRoom.meeting_id).where(VideoRoom.invitation_hash == digest)
    )
    if meeting_id is None:
        raise HTTPException(403, "Invitation is invalid or expired")
    # Lock order matches manager operations and meeting PATCH: meeting, then room.
    meeting = await get_meeting(session, meeting_id, lock=True)
    room = await session.get(VideoRoom, meeting_id)
    if room is None or room.invitation_hash != digest:
        raise HTTPException(403, "Invitation is invalid or expired")
    check_active(meeting, room)
    return meeting, room


async def guest_room(session: AsyncSession, invitation: str):
    async with transaction(session):
        meeting, _ = await guest_meeting(session, invitation)
        return await read_room(session, meeting)


async def connect(
    session: AsyncSession,
    gateway: LiveKitGateway,
    settings: Settings,
    name: str,
    *,
    meeting_id: int | None = None,
    manager_id: int | None = None,
    invitation: str | None = None,
):
    async with transaction(session):
        if invitation is not None:
            meeting, room = await guest_meeting(session, invitation)
            identity = "guest"
        else:
            meeting = await owned_meeting(session, meeting_id, manager_id)
            room = await session.get(VideoRoom, meeting.id)
            identity = f"manager-{manager_id}"
        check_active(meeting, room)
        if room is None:
            raise NotFound("Video room not found")
        if datetime.now(UTC) < window(meeting)[0]:
            raise Conflict("Video room opens 15 minutes before the meeting")
        # Bounded media request under the meeting lock prevents a concurrent
        # cancellation from issuing credentials for the old meeting generation.
        await gateway.ensure_room(room.room_name)
        return ConnectionRead(
            server_url=settings.livekit_public_url,
            room_name=room.room_name,
            participant_token=gateway.token(room.room_name, identity, name.strip()),
        )


async def enqueue_cleanup(session: AsyncSession, room_name: str):
    await session.execute(insert(VideoCleanup).values(room_name=room_name).on_conflict_do_nothing())


async def invalidate_for_meeting(session: AsyncSession, meeting_id: int, *, reschedule=False):
    """Caller owns the transaction and must already hold the meeting row lock."""
    room = await session.get(VideoRoom, meeting_id)
    if room:
        await enqueue_cleanup(session, room.room_name)
        if reschedule:
            await session.delete(room)
        else:
            room.closed = True
            room.invitation_hash = None


async def close_room(session: AsyncSession, meeting_id: int, manager_id: int):
    async with transaction(session):
        await owned_meeting(session, meeting_id, manager_id)
        await invalidate_for_meeting(session, meeting_id)


async def reconcile(session_factory, gateway: LiveKitGateway):
    async with session_factory() as session, session.begin():
        expired = await session.scalars(
            select(Meeting)
            .join(VideoRoom, VideoRoom.meeting_id == Meeting.id)
            .where(
                ~VideoRoom.closed,
                Meeting.ends_at < datetime.now(UTC) - timedelta(minutes=15),
            )
            .limit(50)
            .with_for_update(of=Meeting, skip_locked=True)
        )
        for meeting in expired:
            await invalidate_for_meeting(session, meeting.id)
    # Keep the cleanup request until the external operation succeeds. Multiple
    # API workers safely share the queue through row locks, including after restart.
    async with session_factory() as session, session.begin():
        jobs = await session.scalars(
            select(VideoCleanup).limit(10).with_for_update(skip_locked=True)
        )
        for job in jobs:
            await gateway.delete_room(job.room_name)
            await session.delete(job)
