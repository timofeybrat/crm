from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", env_prefix="CRM_", extra="ignore"
    )

    app_name: str = "CRM API"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://crm:crm_local_only@localhost:5432/crm"
    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
