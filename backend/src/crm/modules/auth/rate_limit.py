import hashlib
import ipaddress
import time
from datetime import UTC, datetime

from fastapi import HTTPException, Request
from sqlalchemy import func
from sqlalchemy.dialects.postgresql import insert

from crm.modules.auth.models import RateBucket


def client_address(request: Request) -> str:
    peer = request.client.host if request.client else "unknown"
    networks = [
        ipaddress.ip_network(value) for value in request.app.state.settings.trusted_proxy_cidrs
    ]

    def trusted(value):
        try:
            return any(ipaddress.ip_address(value) in network for network in networks)
        except ValueError:
            return False

    forwarded = request.headers.get("x-forwarded-for", "")
    if not trusted(peer) or len(forwarded) > 1024:
        return peer
    chain = [part.strip() for part in forwarded.split(",") if part.strip()]
    for value in reversed(chain):
        try:
            ipaddress.ip_address(value)
        except ValueError:
            return peer
        if not trusted(value):
            return value
    return peer


async def consume(request: Request, specs: list[tuple[str, str, int, int]]):
    """Atomic shared PostgreSQL counters, committed even for a failed login."""
    now = int(time.time())
    keys = []
    retry = 0
    async with request.app.state.session_factory() as session, session.begin():
        for scope, value, limit, seconds in specs:
            start = now // seconds * seconds
            key = hashlib.sha256(f"{scope}:{value}:{start}".encode()).hexdigest()
            keys.append(key)
            count = await session.scalar(
                insert(RateBucket)
                .values(
                    id_hash=key, attempts=1, expires_at=datetime.fromtimestamp(start + seconds, UTC)
                )
                .on_conflict_do_update(
                    index_elements=[RateBucket.id_hash],
                    set_={"attempts": func.least(RateBucket.attempts + 1, limit + 1)},
                )
                .returning(RateBucket.attempts)
            )
            if count > limit:
                retry = max(retry, start + seconds - now)
    if retry:
        raise HTTPException(
            429,
            "Too many login attempts" if specs[0][0] == "login-ip" else "Too many requests",
            headers={"Retry-After": str(max(1, retry))},
        )
    return keys
