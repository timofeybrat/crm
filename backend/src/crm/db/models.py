"""Explicit ORM registration for Alembic. No create_all at application startup."""

from crm.modules.auth.models import ManagerAccount
from crm.modules.calls.models import Call
from crm.modules.companies.models import Company
from crm.modules.managers.models import Manager
from crm.modules.meetings.models import Meeting, MeetingHistory
from crm.modules.video_calls.models import VideoCleanup, VideoRoom

__all__ = [
    "Call",
    "Company",
    "Manager",
    "ManagerAccount",
    "Meeting",
    "MeetingHistory",
    "VideoCleanup",
    "VideoRoom",
]
