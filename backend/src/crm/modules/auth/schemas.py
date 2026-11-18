from pydantic import BaseModel, Field, SecretStr


class LoginRequest(BaseModel):
    login: str = Field(min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9._@-]+$")
    password: SecretStr = Field(min_length=1, max_length=128)


class UserRead(BaseModel):
    account_id: int
    manager_id: int
    name: str
    login: str
    role: str
