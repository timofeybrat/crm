from functools import lru_cache

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        env_prefix="CRM_",
        extra="ignore",
        hide_input_in_errors=True,
    )

    app_name: str = "CRM API"
    debug: bool = False
    database_url: str = "postgresql+asyncpg://crm:crm_local_only@localhost:5432/crm"
    cors_origins: list[str] = ["http://localhost:3000"]
    video_enabled: bool = False
    livekit_url: str = "http://localhost:7880"
    livekit_public_url: str = "ws://localhost:7880"
    livekit_api_key: SecretStr = SecretStr("")
    livekit_api_secret: SecretStr = SecretStr("")
    video_manager_keys: dict[int, SecretStr] = {}
    frontend_url: str = "http://localhost:3000"

    @model_validator(mode="after")
    def validate_video(self):
        if self.video_enabled:
            if not self.livekit_api_key.get_secret_value():
                raise ValueError("Configure CRM_LIVEKIT_API_KEY")
            if len(self.livekit_api_secret.get_secret_value()) < 32:
                raise ValueError("CRM_LIVEKIT_API_SECRET must contain at least 32 characters")
            if not self.video_manager_keys or any(
                manager_id <= 0 or len(key.get_secret_value()) < 32
                for manager_id, key in self.video_manager_keys.items()
            ):
                raise ValueError("Configure CRM_VIDEO_MANAGER_KEYS with strong per-manager keys")
            if not self.livekit_public_url.startswith(("ws://", "wss://")):
                raise ValueError("CRM_LIVEKIT_PUBLIC_URL must use ws:// or wss://")
            if not self.frontend_url.startswith(("http://", "https://")):
                raise ValueError("CRM_FRONTEND_URL must use http:// or https://")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
