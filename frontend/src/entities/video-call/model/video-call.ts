import { z } from "zod";

export const videoRoomSchema = z.object({
  meeting_id: z.number(),
  manager_name: z.string(),
  company_name: z.string(),
  starts_at: z.string(),
  ends_at: z.string(),
  opens_at: z.string(),
  closes_at: z.string(),
  room_exists: z.boolean(),
  closed: z.boolean(),
});
export const connectionSchema = z.object({
  server_url: z.string(),
  participant_token: z.string(),
  room_name: z.string(),
});
export const invitationSchema = z.object({ url: z.string(), expires_at: z.string() });
export type VideoRoomInfo = z.infer<typeof videoRoomSchema>;
export type VideoConnection = z.infer<typeof connectionSchema>;
export type VideoAccess =
  { role: "manager"; meetingId: number; key: string } | { role: "guest"; invitation: string };
