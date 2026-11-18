from fastapi import APIRouter, Request, Response
from sqlalchemy import delete

from crm.modules.auth import sessions
from crm.modules.auth.models import RateBucket
from crm.modules.auth.rate_limit import client_address, consume
from crm.modules.auth.schemas import LoginRequest, UserRead
from crm.modules.auth.sessions import UserDep

router = APIRouter(prefix="/auth", tags=["authentication"])


@router.get("/csrf")
async def csrf(request: Request, response: Response):
    await consume(request, [("csrf", client_address(request), 60, 60)])
    return await sessions.csrf_challenge(request, response)


@router.post("/login", response_model=UserRead)
async def login(data: LoginRequest, request: Request, response: Response):
    settings = request.app.state.settings
    # Origin/CSRF validation precedes rate counters to prevent cross-site account lockout.
    async with request.app.state.session_factory() as session:
        sessions.check_csrf(request, await sessions.session_record(request, session))
    keys = await consume(
        request,
        [
            ("login-ip", client_address(request), settings.login_ip_limit, 900),
            ("login-name", data.login.lower(), settings.login_max_failures, 900),
        ],
    )
    result = await sessions.login(request, response, data.login, data.password.get_secret_value())
    # Successful logins clear the account's failure budget, but not the IP budget.
    async with request.app.state.session_factory() as session, session.begin():
        await session.execute(delete(RateBucket).where(RateBucket.id_hash == keys[1]))
    return result


@router.get("/me", response_model=UserRead)
async def me(user: UserDep):
    return user


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    await sessions.logout(request, response)
