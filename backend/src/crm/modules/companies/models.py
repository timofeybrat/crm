from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from crm.db.base import Base


class CompanyStatus(StrEnum):
    NEW = "new"
    NO_ANSWER = "no_answer"
    REFUSED = "refused"
    MEETING_SET = "meeting_set"


class Company(Base):
    __tablename__ = "companies"
    __table_args__ = (
        CheckConstraint("bin ~ '^[0-9]{12}$'", name="bin_format"),
        CheckConstraint("status IN ('new', 'no_answer', 'refused', 'meeting_set')", name="status"),
        Index("ix_companies_status_id", "status", "id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    bin: Mapped[str] = mapped_column(String(12), unique=True)
    phone: Mapped[str] = mapped_column(String(32))
    status: Mapped[str] = mapped_column(String(20), default=CompanyStatus.NEW, server_default="new")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
