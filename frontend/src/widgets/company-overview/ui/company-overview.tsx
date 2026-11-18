"use client";

import { useQueries } from "@tanstack/react-query";
import { Building2, CalendarCheck, PhoneMissed, Sparkles } from "lucide-react";
import { companiesOptions, type CompanyStatus } from "@/entities/company";

const metrics: { title: string; caption: string; status?: CompanyStatus; Icon: typeof Building2 }[] = [
  { title: "Всего организаций", caption: "Контакты в вашей базе", Icon: Building2 },
  { title: "Новые", caption: "Ещё не звонили", status: "new", Icon: Sparkles },
  { title: "Не ответили", caption: "Последний результат звонка", status: "no_answer", Icon: PhoneMissed },
  { title: "Встреча назначена", caption: "Последний результат звонка", status: "meeting_set", Icon: CalendarCheck },
];
export function CompanyOverview() {
  const queries = useQueries({ queries: metrics.map((item) => companiesOptions({ status: item.status, limit: 1 })) });
  return <div className="stats-grid">{metrics.map(({ title, caption, Icon }, index) => <div className="stat-card" key={title}><div className="stat-top"><span>{title}</span><span className="stat-icon"><Icon size={15} strokeWidth={1.6} /></span></div><div className="stat-value">{queries[index].isPending ? <span className="skeleton inline-block h-8 w-12" /> : queries[index].isError ? "—" : queries[index].data?.total.toLocaleString("ru-RU")}</div><div className="stat-caption">{caption}</div></div>)}</div>;
}
