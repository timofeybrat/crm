import { queryOptions } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";
import { managersSchema } from "../model/manager";

export const managersOptions = queryOptions({
  queryKey: ["managers"],
  queryFn: async ({ signal }) =>
    managersSchema.parse(await apiRequest<unknown>("/managers", { signal })),
  staleTime: 5 * 60_000,
});
