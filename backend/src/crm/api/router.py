from fastapi import APIRouter

from crm.modules.companies.router import router as companies_router
from crm.modules.health.router import router as health_router

router = APIRouter()
router.include_router(health_router)
router.include_router(companies_router)
