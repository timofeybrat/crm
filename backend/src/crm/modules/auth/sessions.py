import hashlib
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlsplit

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select

from crm.modules.auth.accounts import authenticate_account
from crm.modules.auth.models import AuthSession, ManagerAccount, RateBucket
from crm.modules.auth.schemas import UserRead
from crm.modules.managers.models import Manager


def digest(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def cookie_names(settings) -> tuple[str, str]:
    prefix = "__Host-" if settings.session_cookie_secure else ""
    return f"{prefix}crm_session", f"{prefix}crm_csrf"


def set_cookies(response: Response, settings, token: str, csrf: str, lifetime: int):
    session_name, csrf_name = cookie_names(settings)
    for name, value, http_only in [(session_name, token, True), (csrf_name, csrf, False)]:
        response.set_cookie(
            name,
            value,
            max_age=lifetime,
            path="/",
            httponly=http_only,
            secure=settings.session_cookie_secure,
            samesite="lax",
        )


def clear_cookies(response: Response, settings):
    for name in cookie_names(settings):
        response.delete_cookie(
            name,
            path="/",
            secure=settings.session_cookie_secure,
            samesite="lax",
            httponly=name.endswith("crm_session"),
        )


def check_origin(request: Request):
    settings = request.app.state.settings
    parsed = urlsplit(settings.frontend_url)
    expected = f"{parsed.scheme}://{parsed.netloc}"
    if (
        request.headers.get("origin") != expected
        or request.headers.get("sec-fetch-site") == "cross-site"
    ):
        raise HTTPException(403, "Untrusted request origin")


async def session_record(request: Request, session):
    name, _ = cookie_names(request.app.state.settings)
    raw = request.cookies.get(name, "")
    record = await session.get(AuthSession, digest(raw)) if len(raw) == 43 else None
    if record is None or record.expires_at <= datetime.now(UTC):
        raise HTTPException(401, "Authentication required")
    return record


def check_csrf(request: Request, record: AuthSession):
    check_origin(request)
    supplied = request.headers.get("x-csrf-token", "")
    if len(supplied) != 43 or not secrets.compare_digest(digest(supplied), record.csrf_hash):
        raise HTTPException(403, "Invalid CSRF token")


async def current_user(request: Request) -> UserRead:
    async with request.app.state.session_factory() as session:
        record = await session_record(request, session)
        if request.method not in {"GET", "HEAD", "OPTIONS"}:
            check_csrf(request, record)
        if record.account_id is None:
            raise HTTPException(401, "Authentication required")
        result = (
            await session.execute(
                select(ManagerAccount, Manager)
                .join(Manager, Manager.id == ManagerAccount.manager_id)
                .where(ManagerAccount.id == record.account_id, ManagerAccount.enabled)
            )
        ).first()
        if result is None:
            raise HTTPException(401, "Authentication required")
        account, manager = result
        return UserRead(
            session_hash=record.id_hash,
            account_id=account.id,
            manager_id=manager.id,
            name=manager.name,
            login=account.login,
            role=account.role,
        )


UserDep = Annotated[UserRead, Depends(current_user)]


async def csrf_challenge(request: Request, response: Response):
    settings = request.app.state.settings
    async with request.app.state.session_factory() as session, session.begin():
        try:
            record = await session_record(request, session)
        except HTTPException:
            record = None
        raw_csrf = request.cookies.get(cookie_names(settings)[1], "")
        if (
            record
            and len(raw_csrf) == 43
            and secrets.compare_digest(digest(raw_csrf), record.csrf_hash)
        ):
            return {"csrf_token": raw_csrf}
        raw_csrf = secrets.token_urlsafe(32)
        if record:
            record.csrf_hash = digest(raw_csrf)
            # Session remains opaque to JS; never send its value in the JSON body.
            _, csrf_name = cookie_names(settings)
            remaining = max(1, int((record.expires_at - datetime.now(UTC)).total_seconds()))
            response.set_cookie(
                csrf_name,
                raw_csrf,
                max_age=remaining,
                path="/",
                secure=settings.session_cookie_secure,
                samesite="lax",
            )
        else:
            token = secrets.token_urlsafe(32)
            session.add(
                AuthSession(
                    id_hash=digest(token),
                    csrf_hash=digest(raw_csrf),
                    expires_at=datetime.now(UTC) + timedelta(minutes=5),
                )
            )
            set_cookies(response, settings, token, raw_csrf, 300)
    return {"csrf_token": raw_csrf}


async def login(request: Request, response: Response, login_name: str, password: str):
    # Verify a challenge before spending memory on Argon2, then revalidate under
    # the account lock before committing. A login always rotates the session ID.
    async with request.app.state.session_factory() as session:
        check_csrf(request, await session_record(request, session))
    settings = request.app.state.settings
    async with request.app.state.session_factory() as session, session.begin():
        account = await authenticate_account(session, login_name, password)
        previous = await session_record(request, session)
        check_csrf(request, previous)
        await session.delete(previous)
        token, csrf = secrets.token_urlsafe(32), secrets.token_urlsafe(32)
        session.add(
            AuthSession(
                id_hash=digest(token),
                account_id=account.id,
                csrf_hash=digest(csrf),
                expires_at=datetime.now(UTC) + timedelta(seconds=settings.session_ttl_seconds),
            )
        )
        manager = await session.get(Manager, account.manager_id)
        user = UserRead(
            account_id=account.id,
            manager_id=manager.id,
            name=manager.name,
            login=account.login,
            role=account.role,
        )
    set_cookies(response, settings, token, csrf, settings.session_ttl_seconds)
    return user


async def logout(request: Request, response: Response):
    async with request.app.state.session_factory() as session, session.begin():
        record = await session_record(request, session)
        check_csrf(request, record)
        await session.delete(record)
    clear_cookies(response, request.app.state.settings)


async def prune_sessions(session_factory):
    async with session_factory() as session, session.begin():
        await session.execute(delete(AuthSession).where(AuthSession.expires_at < datetime.now(UTC)))
        await session.execute(delete(RateBucket).where(RateBucket.expires_at < datetime.now(UTC)))
