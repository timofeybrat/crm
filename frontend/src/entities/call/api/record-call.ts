import { apiRequest } from "@/shared/api";
import { callSchema, type CallResult } from "../model/call";

export async function recordCall(data: {
  company_id: number;
  result: CallResult;
  meeting_id?: number;
}) {
  return callSchema.parse(
    await apiRequest<unknown>("/calls", { method: "POST", body: JSON.stringify(data) }),
  );
}
