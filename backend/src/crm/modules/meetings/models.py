from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, func, text
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from crm.db.base import Base


class MeetingStatus(StrEnum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class Meeting(Base):
    __tablename__ = "meetings"
    __table_args__ = (
        CheckConstraint("ends_at = starts_at + interval '60 minutes'", name="duration"),
        CheckConstraint("status IN ('scheduled', 'cancelled', 'completed')", name="status"),
        ExcludeConstraint(
            ("manager_id", "="),
            (func.tstzrange(text("starts_at"), text("ends_at"), "[)"), "&&"),
            where=text("status = 'scheduled'"),
            name="ex_meetings_manager_overlap",
            using="gist",
        ),
        Index(
            "uq_meetings_active_company",
            "company_id",
            unique=True,
            postgresql_where=text("status = 'scheduled'"),
        ),
        Index("ix_meetings_manager_start", "manager_id", "starts_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    manager_id: Mapped[int] = mapped_column(ForeignKey("managers.id"))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    original_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[str] = mapped_column(
        String(20),
        default=MeetingStatus.SCHEDULED,
        server_default="scheduled",
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MeetingHistory(Base):
    __tablename__ = "meeting_history"
    __table_args__ = (
        CheckConstraint("action IN ('create', 'reschedule', 'cancel', 'complete')", name="action"),
        Index("ix_meeting_history_meeting_id_id", "meeting_id", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    meeting_id: Mapped[int] = mapped_column(ForeignKey("meetings.id"))
    action: Mapped[str] = mapped_column(String(20))
    old_starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    old_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    old_manager_id: Mapped[int | None] = mapped_column(ForeignKey("managers.id"))
    old_status: Mapped[str | None] = mapped_column(String(20))
    new_starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    new_ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    new_manager_id: Mapped[int] = mapped_column(ForeignKey("managers.id"))
    new_status: Mapped[str] = mapped_column(String(20))
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
