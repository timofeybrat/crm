import { apiRequest } from "@/shared/api";
import {
  connectionSchema,
  invitationSchema,
  videoRoomSchema,
  type VideoAccess,
} from "../model/video-call";

function managerHeaders(key: string) {
  return { Authorization: `Bearer ${key}` };
}

export async function getVideoRoom(meetingId: number, key: string, signal?: AbortSignal) {
  return videoRoomSchema.parse(
    await apiRequest(`/video/meetings/${meetingId}`, {
      headers: managerHeaders(key),
      cache: "no-store",
      signal,
    }),
  );
}
export async function createVideoRoom(meetingId: number, key: string) {
  return videoRoomSchema.parse(
    await apiRequest(`/video/meetings/${meetingId}/room`, {
      method: "POST",
      headers: managerHeaders(key),
    }),
  );
}
export async function inviteVideoGuest(meetingId: number, key: string) {
  return invitationSchema.parse(
    await apiRequest(`/video/meetings/${meetingId}/invitation`, {
      method: "POST",
      headers: managerHeaders(key),
    }),
  );
}
export async function closeVideoRoom(meetingId: number, key: string) {
  await apiRequest(`/video/meetings/${meetingId}/close`, {
    method: "POST",
    headers: managerHeaders(key),
  });
}
export async function getGuestRoom(invitation: string, signal?: AbortSignal) {
  return videoRoomSchema.parse(
    await apiRequest("/video/guest", {
      method: "POST",
      body: JSON.stringify({ invitation }),
      signal,
    }),
  );
}
export async function joinVideoRoom(access: VideoAccess, name: string) {
  const path =
    access.role === "guest" ? "/video/guest/join" : `/video/meetings/${access.meetingId}/join`;
  return connectionSchema.parse(
    await apiRequest(path, {
      method: "POST",
      headers: access.role === "manager" ? managerHeaders(access.key) : undefined,
      body: JSON.stringify({
        name,
        ...(access.role === "guest" ? { invitation: access.invitation } : {}),
      }),
    }),
  );
}
