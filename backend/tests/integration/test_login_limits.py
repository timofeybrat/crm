from concurrent.futures import ThreadPoolExecutor

from fastapi.testclient import TestClient

from crm.core.config import Settings
from crm.main import create_app


def test_failed_logins_are_limited_and_cannot_spoof_forwarded_ip(db, test_database_url):
    with TestClient(
        create_app(
            Settings(
                database_url=test_database_url,
                video_enabled=False,
                login_max_failures=2,
                login_ip_limit=4,
            )
        )
    ) as c:
        csrf = c.get("/auth/csrf").json()["csrf_token"]
        headers = {"Origin": "http://localhost:3000", "X-CSRF-Token": csrf}
        body = {"login": "unknown", "password": "wrong"}
        for _ in range(2):
            assert c.post("/auth/login", json=body, headers=headers).status_code == 401
        limited = c.post(
            "/auth/login", json=body, headers={**headers, "X-Forwarded-For": "198.51.100.1"}
        )
        assert limited.status_code == 429 and int(limited.headers["retry-after"]) > 0
        assert (
            c.post("/auth/login", json={**body, "login": "other"}, headers=headers).status_code
            == 401
        )
        assert (
            c.post(
                "/auth/login",
                json={**body, "login": "third"},
                headers={**headers, "X-Forwarded-For": "198.51.100.2"},
            ).status_code
            == 429
        )


def test_parallel_attempts_share_atomic_budget(db, test_database_url):
    with TestClient(
        create_app(
            Settings(database_url=test_database_url, video_enabled=False, login_max_failures=2)
        )
    ) as c:
        csrf = c.get("/auth/csrf").json()["csrf_token"]

        def attempt(_):
            return c.post(
                "/auth/login",
                json={"login": "unknown", "password": "wrong"},
                headers={"Origin": "http://localhost:3000", "X-CSRF-Token": csrf},
            ).status_code

        with ThreadPoolExecutor(max_workers=4) as pool:
            codes = list(pool.map(attempt, range(4)))
        assert sorted(codes) == [401, 401, 429, 429]


def test_expired_buckets_are_pruned(client, db):
    from crm.modules.auth.sessions import prune_sessions

    db("UPDATE auth_rate_buckets SET expires_at = now() - interval '1 second'")
    client.portal.call(prune_sessions, client.app.state.session_factory)
    assert db("SELECT count(*) AS n FROM auth_rate_buckets")[0]["n"] == 0
