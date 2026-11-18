from fastapi import HTTPException

from crm.modules.auth.schemas import UserRead


def require_meeting_access(user: UserRead, manager_id: int):
    if user.role != "admin" and user.manager_id != manager_id:
        raise HTTPException(403, "Meeting belongs to another manager")
