import pytest
from pydantic import SecretStr, ValidationError

from crm.core.config import Settings


def test_disabled_video_needs_no_credentials():
    settings = Settings(_env_file=None, video_enabled=False)
    assert not settings.video_enabled


def test_enabled_video_refuses_weak_secrets_without_echoing_them():
    secret = "short-sensitive-value"
    with pytest.raises(ValidationError) as error:
        Settings(
            _env_file=None,
            video_enabled=True,
            livekit_api_key=SecretStr("local"),
            livekit_api_secret=SecretStr(secret),
        )
    assert secret not in str(error.value)


def test_video_uses_sessions_without_static_manager_keys():
    settings = Settings(
        _env_file=None,
        video_enabled=True,
        livekit_api_key=SecretStr("local"),
        livekit_api_secret=SecretStr("test-secret-" + "a" * 32),
    )
    assert settings.video_enabled
