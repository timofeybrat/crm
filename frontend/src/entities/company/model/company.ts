import { z } from "zod";

export const companyStatusSchema = z.enum(["new", "no_answer", "refused", "meeting_set"]);
export type CompanyStatus = z.infer<typeof companyStatusSchema>;
export const companySchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  bin: z.string(),
  phone: z.string(),
  status: companyStatusSchema,
  created_at: z.string(),
});
export type Company = z.infer<typeof companySchema>;
export const companyPageSchema = z.object({
  items: z.array(companySchema),
  total: z.number(),
  limit: z.number(),
  offset: z.number(),
});
export const companyLabels: Record<CompanyStatus, string> = {
  new: "Новая",
  no_answer: "Не ответили",
  refused: "Отказ",
  meeting_set: "Встреча назначена",
};
