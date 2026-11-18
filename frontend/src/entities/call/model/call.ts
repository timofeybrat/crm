import { z } from "zod";

export const callSchema = z.object({
  id: z.number(),
  company_id: z.number(),
  result: z.enum(["no_answer", "refused", "meeting_set"]),
  meeting_id: z.number().nullable(),
  created_at: z.string(),
});
export type CallResult = z.infer<typeof callSchema>["result"];
