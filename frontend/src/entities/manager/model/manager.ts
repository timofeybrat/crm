import { z } from "zod";

export const managersSchema = z.array(z.object({ id: z.number(), name: z.string() }));
