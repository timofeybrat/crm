import asyncio
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager, suppress

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from crm.api.router import router
from crm.core.config import Settings, get_settings
from crm.core.errors import Conflict, DomainError, NotFound
from crm.modules.auth.sessions import prune_sessions
from crm.modules.video_calls.gateway import LiveKitGateway
from crm.modules.video_calls.service import reconcile


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or get_settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        engine = create_async_engine(
            settings.database_url,
            pool_pre_ping=True,
            hide_parameters=True,
            connect_args={"timeout": 5},
        )
        app.state.session_factory = async_sessionmaker(engine, expire_on_commit=False)
        app.state.video_gateway = LiveKitGateway(settings)

        async def cleanup_video():
            while True:
                try:
                    await reconcile(app.state.session_factory, app.state.video_gateway)
                except Exception:
                    # Never log SDK exception bodies: they may contain credentials.
                    logging.getLogger(__name__).warning("Video cleanup failed; retrying")
                await asyncio.sleep(10)

        cleanup_task = asyncio.create_task(cleanup_video()) if settings.video_enabled else None

        async def cleanup_auth():
            while True:
                await asyncio.sleep(60)
                try:
                    await prune_sessions(app.state.session_factory)
                except Exception:
                    logging.getLogger(__name__).warning("Session cleanup failed; retrying")

        auth_cleanup_task = asyncio.create_task(cleanup_auth())
        try:
            yield
        finally:
            auth_cleanup_task.cancel()
            with suppress(asyncio.CancelledError):
                await auth_cleanup_task
            if cleanup_task:
                cleanup_task.cancel()
                with suppress(asyncio.CancelledError):
                    await cleanup_task
            await engine.dispose()

    app = FastAPI(title=settings.app_name, debug=settings.debug, lifespan=lifespan)
    app.state.settings = settings

    @app.middleware("http")
    async def video_privacy_headers(request: Request, call_next):
        response = await call_next(request)
        if request.url.path not in {"/health", "/ready"}:
            response.headers["Cache-Control"] = "no-store"
            response.headers["Referrer-Policy"] = "no-referrer"
        return response

    @app.exception_handler(RequestValidationError)
    async def validation_error_handler(request: Request, exc: RequestValidationError):
        # Pydantic's default error includes the raw input. Never echo invitation
        # secrets, even when a guest submits malformed credentials.
        errors = [
            {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]
        return JSONResponse(status_code=422, content={"detail": errors})

    @app.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        code = 404 if isinstance(exc, NotFound) else 409 if isinstance(exc, Conflict) else 422
        return JSONResponse(status_code=code, content={"detail": str(exc)})

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST", "PATCH", "OPTIONS"],
        allow_headers=["Content-Type", "Authorization", "X-CSRF-Token"],
        allow_credentials=True,
    )
    app.include_router(router)
    return app


app = create_app()
