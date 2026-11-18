from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from urllib.parse import parse_qs, urlsplit

import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import SecretStr

from crm.core.config import Settings
from crm.main import create_app
from crm.modules.video_calls.gateway import LiveKitGateway
from crm.modules.video_calls.service import reconcile

KEY = "test-manager-key-" + "a" * 32
OTHER_KEY = "test-manager-key-" + "b" * 32
API_SECRET = "test-livekit-secret-" + "c" * 32
AUTH = {"Authorization": f"Bearer {KEY}"}


class FakeGateway:
    def __init__(self, settings):
        self.created = []
        self.deleted = []
        self.fail = False
        self.real = LiveKitGateway(settings)

    async def ensure_room(self, name):
        if self.fail:
            raise HTTPException(503, "Video service unavailable")
        self.created.append(name)

    async def delete_room(self, name):
        if self.fail:
            raise HTTPException(503, "Video service unavailable")
        self.deleted.append(name)

    def token(self, *args):
        return self.real.token(*args)


@pytest.fixture
def video(db, test_database_url):
    settings = Settings(
        database_url=test_database_url,
        video_enabled=True,
        livekit_api_key=SecretStr("test-api-key"),
        livekit_api_secret=SecretStr(API_SECRET),
        video_manager_keys={1: SecretStr(KEY), 2: SecretStr(OTHER_KEY)},
    )
    app = create_app(settings)
    with TestClient(app) as client:
        fake = FakeGateway(settings)
        app.state.video_gateway = fake
        yield client, fake, app


def meeting(db, *, delta=0):
    # Insert directly to exercise the video access window independently of the
    # CRM's weekday/business-hour validator, at any time of day in CI.
    company = db(
        "INSERT INTO companies (name, bin, phone, status) "
        "VALUES ('Video test', '000000000001', '+70000000000', 'new') RETURNING id"
    )[0]["id"]
    start = datetime.now(UTC) + timedelta(minutes=delta)
    return db(
        "INSERT INTO meetings (company_id, manager_id, starts_at, ends_at, "
        "original_starts_at, status) VALUES (:company, 1, :start, :end, :start, 'scheduled') "
        "RETURNING id",
        {"company": company, "start": start, "end": start + timedelta(hours=1)},
    )[0]["id"]


def prepare(video, db, *, delta=0):
    client, _, _ = video
    mid = meeting(db, delta=delta)
    assert client.post(f"/video/meetings/{mid}/room", headers=AUTH).status_code == 200
    response = client.post(f"/video/meetings/{mid}/invitation", headers=AUTH)
    assert response.status_code == 200
    invitation = parse_qs(urlsplit(response.json()["url"]).fragment)["invite"][0]
    return mid, invitation


def test_disabled_and_bad_credentials(client, video, db):
    assert client.get("/video/meetings/1").status_code == 503
    browser, _, _ = video
    mid = meeting(db)
    assert browser.get(f"/video/meetings/{mid}").status_code == 401
    assert (
        browser.get(f"/video/meetings/{mid}", headers={"Authorization": "Bearer wrong"}).status_code
        == 401
    )
    assert (
        browser.get(
            f"/video/meetings/{mid}", headers={"Authorization": f"Bearer {OTHER_KEY}"}
        ).status_code
        == 403
    )
    assert browser.get("/video/meetings/999999", headers=AUTH).status_code == 404


def test_concurrent_create_is_idempotent(video, db):
    client, _, _ = video
    mid = meeting(db)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda _: client.post(f"/video/meetings/{mid}/room", headers=AUTH), range(2))
        )
    assert [r.status_code for r in results] == [200, 200]
    assert db("SELECT count(*) AS n FROM video_rooms")[0]["n"] == 1


def test_invitation_digest_rotation_and_privacy(video, db):
    client, _, _ = video
    mid, invitation = prepare(video, db)
    saved = db("SELECT invitation_hash FROM video_rooms")[0]["invitation_hash"]
    assert invitation != saved and len(saved) == 64
    response = client.post("/video/guest", json={"invitation": invitation})
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["meeting_id"] == mid
    new = client.post(f"/video/meetings/{mid}/invitation", headers=AUTH)
    assert "#invite=" in new.json()["url"]
    assert client.post("/video/guest", json={"invitation": invitation}).status_code == 403
    malformed = client.post("/video/guest", json={"invitation": "secret"})
    assert malformed.status_code == 422 and "secret" not in malformed.text


def test_tokens_have_minimal_grants_and_stable_identities(video, db):
    client, fake, _ = video
    mid, invitation = prepare(video, db)
    guest = client.post("/video/guest/join", json={"invitation": invitation, "name": "Guest"})
    manager = client.post(f"/video/meetings/{mid}/join", headers=AUTH, json={"name": "Manager"})
    assert guest.status_code == manager.status_code == 200
    assert fake.created[0] == fake.created[1]
    for response, identity in [(guest, "guest"), (manager, "manager-1")]:
        claims = jwt.decode(
            response.json()["participant_token"],
            API_SECRET,
            algorithms=["HS256"],
            issuer="test-api-key",
        )
        assert claims["sub"] == identity
        assert claims["exp"] - claims["nbf"] == 60
        grants = claims["video"]
        assert grants["roomJoin"] is True and grants.get("roomAdmin") is None
        assert grants["canPublishSources"] == ["camera", "microphone"]
        assert grants["canPublishData"] is False
        assert "roomConfig" not in claims  # Joining must not bootstrap a deleted room.


@pytest.mark.parametrize("delta, expected", [(30, 409), (-90, 409), (-5, 200)])
def test_join_window(video, db, delta, expected):
    client, _, _ = video
    mid = meeting(db, delta=delta)
    created = client.post(f"/video/meetings/{mid}/room", headers=AUTH)
    if delta == -90:
        assert created.status_code == 409
    else:
        assert created.status_code == 200
        assert (
            client.post(
                f"/video/meetings/{mid}/join", headers=AUTH, json={"name": "Manager"}
            ).status_code
            == expected
        )


def test_media_failure_retry_uses_same_room(video, db):
    client, fake, _ = video
    mid, _ = prepare(video, db)
    saved = db("SELECT room_name FROM video_rooms")[0]["room_name"]
    fake.fail = True
    response = client.post(f"/video/meetings/{mid}/join", headers=AUTH, json={"name": "Manager"})
    assert response.status_code == 503
    fake.fail = False
    assert (
        client.post(
            f"/video/meetings/{mid}/join", headers=AUTH, json={"name": "Manager"}
        ).status_code
        == 200
    )
    assert fake.created == [saved]


def test_close_revokes_new_access_and_is_idempotent(video, db):
    client, _, _ = video
    mid, invitation = prepare(video, db)
    for _ in range(2):
        assert client.post(f"/video/meetings/{mid}/close", headers=AUTH).status_code == 204
    assert (
        client.post(
            "/video/guest/join", json={"invitation": invitation, "name": "Guest"}
        ).status_code
        == 403
    )
    assert (
        client.post(
            f"/video/meetings/{mid}/join", headers=AUTH, json={"name": "Manager"}
        ).status_code
        == 409
    )
    assert db("SELECT count(*) AS n FROM video_cleanup")[0]["n"] == 1
    assert db("SELECT status FROM meetings")[0]["status"] == "scheduled"


def test_cancel_revokes_invitation_in_same_transaction(video, db):
    client, _, _ = video
    mid, invitation = prepare(video, db)
    assert client.patch(f"/meetings/{mid}", json={"action": "cancel"}).status_code == 200
    assert client.post("/video/guest", json={"invitation": invitation}).status_code == 403
    assert db("SELECT closed FROM video_rooms")[0]["closed"]
    assert db("SELECT count(*) AS n FROM video_cleanup")[0]["n"] == 1


def test_reschedule_invalidates_generation(video, db):
    client, _, _ = video
    mid, invitation = prepare(video, db)
    old = db("SELECT room_name FROM video_rooms")[0]["room_name"]
    # Monday, 10:00 Almaty, UTC input; no dependency on today's weekday.
    response = client.patch(
        f"/meetings/{mid}", json={"action": "reschedule", "starts_at": "2030-01-07T05:00:00Z"}
    )
    assert response.status_code == 200
    assert client.post("/video/guest", json={"invitation": invitation}).status_code == 403
    assert client.post(f"/video/meetings/{mid}/room", headers=AUTH).status_code == 200
    assert db("SELECT room_name FROM video_rooms")[0]["room_name"] != old
    assert db("SELECT room_name FROM video_cleanup")[0]["room_name"] == old


def test_cleanup_retry_survives_failure(video, db):
    client, fake, app = video
    mid, _ = prepare(video, db)
    client.post(f"/video/meetings/{mid}/close", headers=AUTH)
    fake.fail = True
    with pytest.raises(HTTPException):
        client.portal.call(reconcile, app.state.session_factory, fake)
    assert db("SELECT count(*) AS n FROM video_cleanup")[0]["n"] == 1
    fake.fail = False
    client.portal.call(reconcile, app.state.session_factory, fake)
    assert len(fake.deleted) == 1
    assert db("SELECT count(*) AS n FROM video_cleanup")[0]["n"] == 0


def test_expired_rooms_are_closed_by_reconciler(video, db):
    client, fake, app = video
    mid, _ = prepare(video, db)
    db(
        "UPDATE meetings SET starts_at = starts_at - interval '2 hours', "
        "ends_at = ends_at - interval '2 hours'"
    )
    client.portal.call(reconcile, app.state.session_factory, fake)
    assert db("SELECT closed FROM video_rooms")[0]["closed"]
    assert len(fake.deleted) == 1
    assert db("SELECT status FROM meetings")[0]["status"] == "scheduled"
