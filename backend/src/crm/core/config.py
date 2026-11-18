import ipaddress
from functools import lru_cache
from typing import Literal

from pydantic import Field, SecretStr, model_validator
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
    frontend_url: str = "http://localhost:3000"
    bootstrap_manager_id: int = 1
    bootstrap_login: str = "manager1"
    bootstrap_password: SecretStr = SecretStr("")
    session_cookie_secure: bool = False
    session_ttl_seconds: int = Field(default=28800, ge=300, le=86400)
    environment: Literal["development", "production"] = "development"
    trusted_proxy_cidrs: list[str] = []
    login_max_failures: int = Field(default=5, ge=1, le=20)
    login_ip_limit: int = Field(default=30, ge=1, le=200)

    @model_validator(mode="after")
    def validate_video(self):
        for network in self.trusted_proxy_cidrs:
            ipaddress.ip_network(network)
        if self.environment == "production":
            if (
                self.debug
                or not self.session_cookie_secure
                or not self.frontend_url.startswith("https://")
            ):
                raise ValueError(
                    "Production requires HTTPS, Secure session cookies and disabled debug"
                )
            if self.video_enabled and not self.livekit_public_url.startswith("wss://"):
                raise ValueError("Production video requires WSS")
        if self.video_enabled:
            if not self.livekit_api_key.get_secret_value():
                raise ValueError("Configure CRM_LIVEKIT_API_KEY")
            if len(self.livekit_api_secret.get_secret_value()) < 32:
                raise ValueError("CRM_LIVEKIT_API_SECRET must contain at least 32 characters")
            if not self.livekit_public_url.startswith(("ws://", "wss://")):
                raise ValueError("CRM_LIVEKIT_PUBLIC_URL must use ws:// or wss://")
            if not self.frontend_url.startswith(("http://", "https://")):
                raise ValueError("CRM_FRONTEND_URL must use http:// or https://")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
