import { z } from "zod";
import { apiRequest } from "@/shared/api";

export const callSchema = z.object({ id: z.number(), company_id: z.number(),
  result: z.enum(["no_answer", "refused", "meeting_set"]), meeting_id: z.number().nullable(), created_at: z.string(),
});
export type CallResult = z.infer<typeof callSchema>["result"];
export async function recordCall(data: { company_id: number; result: CallResult; meeting_id?: number }) {
  return callSchema.parse(await apiRequest<unknown>("/calls", { method: "POST", body: JSON.stringify(data) }));
}
