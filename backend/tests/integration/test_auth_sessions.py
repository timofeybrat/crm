import pytest
from fastapi.testclient import TestClient

from crm.core.config import Settings
from crm.main import create_app
from crm.modules.auth.passwords import hash_password

PASSWORD = "public-test-password-only"
ORIGIN = "http://localhost:3000"


@pytest.fixture
def browser(db, test_database_url):
    db(
        "INSERT INTO manager_accounts (manager_id, login, password_hash, role) "
        "VALUES (1, 'manager1', :hash, 'admin')",
        {"hash": hash_password(PASSWORD)},
    )
    with TestClient(create_app(Settings(database_url=test_database_url, video_enabled=False))) as c:
        yield c


def login(browser, **headers):
    csrf = browser.get("/auth/csrf").json()["csrf_token"]
    return browser.post(
        "/auth/login",
        json={"login": "MANAGER1", "password": PASSWORD},
        headers={"Origin": ORIGIN, "X-CSRF-Token": csrf, **headers},
    )


def test_login_rotates_anonymous_session_and_sets_cookie_flags(browser, db):
    assert browser.get("/auth/me").status_code == 401
    csrf = browser.get("/auth/csrf")
    assert csrf.headers["cache-control"] == "no-store"
    old_id = browser.cookies.get("crm_session")
    assert browser.get("/auth/me").status_code == 401
    result = login(browser)
    assert result.status_code == 200
    assert result.json()["manager_id"] == 1 and result.json()["role"] == "admin"
    assert "password" not in result.text and "csrf" not in result.text
    assert browser.cookies.get("crm_session") != old_id
    flags = result.headers.get_list("set-cookie")
    session_cookie = next(c for c in flags if c.startswith("crm_session="))
    assert (
        "HttpOnly" in session_cookie
        and "SameSite=lax" in session_cookie
        and "Path=/" in session_cookie
    )
    saved = db("SELECT id_hash, csrf_hash FROM auth_sessions")[0]
    assert saved["id_hash"] != browser.cookies.get("crm_session")
    assert saved["csrf_hash"] != browser.cookies.get("crm_csrf")
    assert browser.get("/auth/me").status_code == 200


@pytest.mark.parametrize("origin", ["https://evil.example", "null", ""])
def test_login_rejects_cross_origin_even_with_csrf(browser, origin):
    assert login(browser, Origin=origin).status_code == 403


def test_login_rejects_missing_and_wrong_csrf(browser):
    browser.get("/auth/csrf")
    body = {"login": "manager1", "password": PASSWORD}
    assert browser.post("/auth/login", json=body, headers={"Origin": ORIGIN}).status_code == 403
    assert (
        browser.post(
            "/auth/login", json=body, headers={"Origin": ORIGIN, "X-CSRF-Token": "x" * 43}
        ).status_code
        == 403
    )


def test_logout_revokes_session_and_checks_csrf(browser):
    assert login(browser).status_code == 200
    assert browser.post("/auth/logout", headers={"Origin": ORIGIN}).status_code == 403
    assert browser.get("/auth/me").status_code == 200
    raw = browser.cookies.get("crm_session")
    headers = {"Origin": ORIGIN, "X-CSRF-Token": browser.cookies.get("crm_csrf")}
    assert browser.post("/auth/logout", headers=headers).status_code == 204
    assert browser.get("/auth/me").status_code == 401
    browser.cookies.set("crm_session", raw)
    assert browser.get("/auth/me").status_code == 401


def test_expired_and_disabled_accounts_cannot_use_session(browser, db):
    assert login(browser).status_code == 200
    db("UPDATE auth_sessions SET expires_at = now() - interval '1 second'")
    assert browser.get("/auth/me").status_code == 401
    assert login(browser).status_code == 200
    db("UPDATE manager_accounts SET enabled = false")
    assert browser.get("/auth/me").status_code == 401


def test_csrf_is_bound_to_the_server_session(browser, test_database_url):
    csrf = browser.get("/auth/csrf").json()["csrf_token"]
    with TestClient(
        create_app(Settings(database_url=test_database_url, video_enabled=False))
    ) as other:
        other.get("/auth/csrf")
        response = other.post(
            "/auth/login",
            json={"login": "manager1", "password": PASSWORD},
            headers={"Origin": ORIGIN, "X-CSRF-Token": csrf},
        )
        assert response.status_code == 403


def test_secure_mode_uses_host_cookies(db, test_database_url):
    with TestClient(
        create_app(
            Settings(
                database_url=test_database_url, video_enabled=False, session_cookie_secure=True
            )
        ),
        base_url="https://testserver",
    ) as c:
        result = c.get("/auth/csrf")
        cookie = next(
            v for v in result.headers.get_list("set-cookie") if v.startswith("__Host-crm_session=")
        )
        assert "Secure" in cookie and "HttpOnly" in cookie and "Domain=" not in cookie
