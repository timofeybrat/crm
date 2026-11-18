import { apiRequest } from "@/shared/api";
import {
  connectionSchema,
  invitationSchema,
  videoRoomSchema,
  type VideoAccess,
} from "../model/video-call";

export async function getVideoRoom(meetingId: number, signal?: AbortSignal) {
  return videoRoomSchema.parse(
    await apiRequest(`/video/meetings/${meetingId}`, {
      cache: "no-store",
      signal,
    }),
  );
}
export async function createVideoRoom(meetingId: number) {
  return videoRoomSchema.parse(
    await apiRequest(`/video/meetings/${meetingId}/room`, {
      method: "POST",
    }),
  );
}
export async function inviteVideoGuest(meetingId: number) {
  return invitationSchema.parse(
    await apiRequest(`/video/meetings/${meetingId}/invitation`, {
      method: "POST",
    }),
  );
}
export async function closeVideoRoom(meetingId: number) {
  await apiRequest(`/video/meetings/${meetingId}/close`, {
    method: "POST",
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
      body: JSON.stringify({
        name,
        ...(access.role === "guest" ? { invitation: access.invitation } : {}),
      }),
    }),
  );
}
