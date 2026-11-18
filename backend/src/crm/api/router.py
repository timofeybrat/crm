from fastapi import APIRouter, Depends

from crm.modules.auth.router import router as auth_router
from crm.modules.auth.sessions import current_user
from crm.modules.calls.router import router as calls_router
from crm.modules.companies.router import router as companies_router
from crm.modules.health.router import router as health_router
from crm.modules.managers.router import router as managers_router
from crm.modules.meetings.router import router as meetings_router
from crm.modules.video_calls.router import router as video_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_router)
protected = APIRouter(dependencies=[Depends(current_user)])
protected.include_router(companies_router)
protected.include_router(meetings_router)
protected.include_router(managers_router)
protected.include_router(calls_router)
router.include_router(protected)
router.include_router(video_router)
