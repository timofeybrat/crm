import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { apiRequest } from "@/shared/api";

const managersSchema = z.array(z.object({ id: z.number(), name: z.string() }));
export const managersOptions = queryOptions({ queryKey: ["managers"],
  queryFn: async ({ signal }) => managersSchema.parse(await apiRequest<unknown>("/managers", { signal })),
  staleTime: 5 * 60_000,
});
