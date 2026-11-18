from fastapi import APIRouter

from crm.modules.auth.router import router as auth_router
from crm.modules.calls.router import router as calls_router
from crm.modules.companies.router import router as companies_router
from crm.modules.health.router import router as health_router
from crm.modules.managers.router import router as managers_router
from crm.modules.meetings.router import router as meetings_router
from crm.modules.video_calls.router import router as video_router

router = APIRouter()
router.include_router(health_router)
router.include_router(auth_router)
router.include_router(companies_router)
router.include_router(meetings_router)
router.include_router(managers_router)
router.include_router(calls_router)
router.include_router(video_router)
