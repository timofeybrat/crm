from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column

from crm.db.base import Base


class CallResult(StrEnum):
    NO_ANSWER = "no_answer"
    REFUSED = "refused"
    MEETING_SET = "meeting_set"


class Call(Base):
    __tablename__ = "calls"
    __table_args__ = (
        CheckConstraint("result IN ('no_answer', 'refused', 'meeting_set')", name="result"),
        CheckConstraint(
            "(result = 'meeting_set' AND meeting_id IS NOT NULL) OR "
            "(result != 'meeting_set' AND meeting_id IS NULL)",
            name="meeting_link",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("companies.id"))
    result: Mapped[str] = mapped_column(String(20))
    meeting_id: Mapped[int | None] = mapped_column(ForeignKey("meetings.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
