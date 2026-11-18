from datetime import datetime

from pydantic import BaseModel, Field, SecretStr


class RoomRead(BaseModel):
    meeting_id: int
    manager_name: str
    company_name: str
    starts_at: datetime
    ends_at: datetime
    opens_at: datetime
    closes_at: datetime
    room_exists: bool
    closed: bool


class GuestRequest(BaseModel):
    invitation: SecretStr = Field(min_length=40, max_length=100)


class JoinRequest(BaseModel):
    name: str = Field(min_length=1, max_length=80, pattern=r"\S")


class GuestJoin(GuestRequest, JoinRequest):
    pass


class ConnectionRead(BaseModel):
    server_url: str
    participant_token: str
    room_name: str


class InvitationRead(BaseModel):
    url: str
    expires_at: datetime
