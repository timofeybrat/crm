from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from crm.db.base import Base


class VideoRoom(Base):
    __tablename__ = "video_rooms"

    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"), primary_key=True)
    room_name: Mapped[str] = mapped_column(String(100), unique=True)
    invitation_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    closed: Mapped[bool] = mapped_column(default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class VideoCleanup(Base):
    """Durable removal requests survive media outages and application restarts."""

    __tablename__ = "video_cleanup"

    room_name: Mapped[str] = mapped_column(String(100), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
