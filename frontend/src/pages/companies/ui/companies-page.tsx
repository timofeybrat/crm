"use client";

import { Suspense, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Info, Plus } from "lucide-react";
import { companyStatusSchema, useCompanyPanel } from "@/entities/company";
import { CreateCompanyDialog } from "@/features/create-company";
import { CompanyOverview } from "@/widgets/company-overview";
import { CompanyTable } from "@/widgets/company-table";
import { Button, Loading } from "@/shared/ui";

function CompaniesContent() {
  const params = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const path = usePathname() ?? "/companies";
  const [create, setCreate] = useState(false);
  const open = useCompanyPanel((state) => state.open);
  const parsed = companyStatusSchema.safeParse(params.get("status"));
  const status = parsed.success ? parsed.data : "";
  const search = (params.get("q") ?? "").slice(0, 200);
  const page = Math.max(1, Math.min(100000, Number(params.get("page")) || 1));
  function update(values: { status?: string; search?: string; page?: number }) {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(values)) {
      const name = key === "search" ? "q" : key;
      if (!value || (key === "page" && value === 1)) next.delete(name); else next.set(name, String(value));
    }
    router.replace(`${path}${next.size ? `?${next}` : ""}`, { scroll: false });
  }
  return <><div className="page-header"><div><p className="eyebrow">Контакты и коммуникации</p><h1 className="page-title">Организации</h1><p className="page-subtitle">Каждый контакт — начало нового сотрудничества.</p></div><Button onClick={() => setCreate(true)} aria-label="Добавить организацию"><Plus size={16} />Добавить организацию</Button></div>
    <CompanyOverview /><CompanyTable status={status} search={search} page={Math.floor(page)} onFilter={update} onCreate={() => setCreate(true)} />
    <p className="bottom-note"><Info size={12} />Статус организации отражает результат последнего звонка.</p>
    {create && <CreateCompanyDialog open onClose={() => setCreate(false)} onCreated={(company) => { setCreate(false); open(company.id); }} />}
  </>;
}
export function CompaniesPage() { return <Suspense fallback={<Loading />}><CompaniesContent /></Suspense>; }
