from datetime import timedelta

import aiohttp
from fastapi import HTTPException
from livekit import api

from crm.core.config import Settings


class LiveKitGateway:
    def __init__(self, settings: Settings):
        self.settings = settings

    def _client(self):
        return api.LiveKitAPI(
            self.settings.livekit_url,
            self.settings.livekit_api_key.get_secret_value(),
            self.settings.livekit_api_secret.get_secret_value(),
            timeout=aiohttp.ClientTimeout(total=5),
        )

    async def ensure_room(self, room_name: str):
        try:
            async with self._client() as client:
                # CreateRoom is idempotent for an existing name. Retry after an
                # ambiguous timeout uses the same persisted name, never a new room.
                await client.room.create_room(
                    api.CreateRoomRequest(name=room_name, max_participants=2, empty_timeout=300)
                )
        except (api.TwirpError, aiohttp.ClientError, TimeoutError) as from_error:
            raise HTTPException(503, "Video service unavailable") from from_error

    async def delete_room(self, room_name: str):
        try:
            async with self._client() as client:
                await client.room.delete_room(api.DeleteRoomRequest(room=room_name))
        except api.TwirpError as exc:
            if exc.code != "not_found":
                raise HTTPException(503, "Video service unavailable") from exc
        except (aiohttp.ClientError, TimeoutError) as exc:
            raise HTTPException(503, "Video service unavailable") from exc

    def token(self, room_name: str, identity: str, name: str) -> str:
        return (
            api.AccessToken(
                self.settings.livekit_api_key.get_secret_value(),
                self.settings.livekit_api_secret.get_secret_value(),
            )
            .with_identity(identity)
            .with_name(name)
            .with_ttl(timedelta(seconds=60))
            .with_grants(
                api.VideoGrants(
                    room_join=True,
                    room=room_name,
                    can_publish_data=False,
                    can_publish_sources=["camera", "microphone"],
                    can_update_own_metadata=False,
                )
            )
            .to_jwt()
        )
