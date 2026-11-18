import { keepPreviousData, queryOptions } from "@tanstack/react-query";
import { apiRequest } from "@/shared/api";
import { companyPageSchema, companySchema, type CompanyStatus } from "../model/company";

export const companyKeys = {
  all: ["companies"] as const,
  detail: (id: number) => ["companies", "detail", id] as const,
};
export type CompanyFilters = { status?: CompanyStatus; search?: string; limit?: number; offset?: number };
export function companiesOptions(filters: CompanyFilters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value !== undefined && value !== "") params.set(key, String(value));
  return queryOptions({
    queryKey: [...companyKeys.all, "list", filters],
    queryFn: async ({ signal }) => companyPageSchema.parse(await apiRequest<unknown>(`/companies?${params}`, { signal })),
    placeholderData: keepPreviousData,
  });
}
export async function createCompany(data: { name: string; bin: string; phone: string }) {
  return companySchema.parse(await apiRequest<unknown>("/companies", { method: "POST", body: JSON.stringify(data) }));
}
