import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { companyKeys, companySchema } from "@/entities/company";
import { callSchema } from "@/entities/call";
import { meetingSchema } from "@/entities/meeting";
import { apiRequest } from "@/shared/api";

const workspaceSchema = companySchema.extend({
  active_meeting: meetingSchema.nullable(),
  recent_meetings: z.array(meetingSchema),
  recent_calls: z.array(callSchema),
});
export function workspaceOptions(id: number) {
  return queryOptions({
    queryKey: companyKeys.detail(id),
    queryFn: async ({ signal }) =>
      workspaceSchema.parse(await apiRequest<unknown>(`/companies/${id}`, { signal })),
  });
}
