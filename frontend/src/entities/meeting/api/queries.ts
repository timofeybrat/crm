import { queryOptions } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";
import { meetingDetailSchema, scheduleSchema } from "../model/meeting";

export const meetingKeys = { all: ["meetings"] as const, schedules: ["schedules"] as const };
export function meetingOptions(id: number) {
  return queryOptions({ queryKey: [...meetingKeys.all, id],
    queryFn: async ({ signal }) => meetingDetailSchema.parse(await apiRequest<unknown>(`/meetings/${id}`, { signal })),
  });
}
export function scheduleOptions(managerId: number, date: string) {
  return queryOptions({ queryKey: [...meetingKeys.schedules, managerId, date], enabled: managerId > 0 && !!date,
    queryFn: async ({ signal }) => scheduleSchema.parse(await apiRequest<unknown>(`/managers/${managerId}/schedule?date=${date}`, { signal })),
  });
}
export async function createMeeting(data: { company_id: number; manager_id: number; starts_at: string }) {
  return meetingDetailSchema.parse(await apiRequest<unknown>("/meetings", { method: "POST", body: JSON.stringify(data) }));
}
export async function updateMeeting(id: number, data: { action: "reschedule"; starts_at: string; manager_id?: number } | { action: "cancel" | "complete" }) {
  return meetingDetailSchema.parse(await apiRequest<unknown>(`/meetings/${id}`, { method: "PATCH", body: JSON.stringify(data) }));
}
