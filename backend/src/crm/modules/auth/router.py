from fastapi import APIRouter, Request, Response

from crm.modules.auth import sessions
from crm.modules.auth.schemas import LoginRequest, UserRead
from crm.modules.auth.sessions import UserDep

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/csrf")
async def csrf(request: Request, response: Response):
    return await sessions.csrf_challenge(request, response)


@router.post("/login", response_model=UserRead)
async def login(data: LoginRequest, request: Request, response: Response):
    return await sessions.login(request, response, data.login, data.password.get_secret_value())


@router.get("/me", response_model=UserRead)
async def me(user: UserDep):
    return user


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    await sessions.logout(request, response)
