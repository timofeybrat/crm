import pytest
from pydantic import ValidationError

from crm.core.config import Settings


@pytest.mark.parametrize(
    "values",
    [
        {},
        {"session_cookie_secure": True},
        {"session_cookie_secure": True, "frontend_url": "https://crm.example", "debug": True},
    ],
)
def test_production_refuses_insecure_cookie_http_and_debug(values):
    with pytest.raises(ValidationError, match="Production requires"):
        Settings(_env_file=None, video_enabled=False, environment="production", **values)


def test_production_secure_defaults_can_be_enabled_explicitly():
    s = Settings(
        _env_file=None,
        video_enabled=False,
        environment="production",
        session_cookie_secure=True,
        frontend_url="https://crm.example",
    )
    assert s.session_cookie_secure
