import { z } from "zod";

export const meetingSchema = z.object({
  id: z.number(), company_id: z.number(), manager_id: z.number(),
  starts_at: z.string(), ends_at: z.string(), original_starts_at: z.string(), created_at: z.string(),
  status: z.enum(["scheduled", "cancelled", "completed"]),
});
export type Meeting = z.infer<typeof meetingSchema>;
const historySchema = z.object({
  id: z.number(), action: z.enum(["create", "reschedule", "cancel", "complete"]),
  old_starts_at: z.string().nullable(), old_ends_at: z.string().nullable(),
  old_manager_id: z.number().nullable(), old_status: z.string().nullable(),
  new_starts_at: z.string(), new_ends_at: z.string(), new_manager_id: z.number(),
  new_status: z.string(), occurred_at: z.string(),
});
export const meetingDetailSchema = meetingSchema.extend({ history: z.array(historySchema) });
export const scheduleSchema = z.object({ manager_id: z.number(), date: z.string(),
  meetings: z.array(meetingSchema.extend({ company_name: z.string() })),
});
export type MeetingDetail = z.infer<typeof meetingDetailSchema>;
export type ScheduledMeeting = z.infer<typeof scheduleSchema>["meetings"][number];
