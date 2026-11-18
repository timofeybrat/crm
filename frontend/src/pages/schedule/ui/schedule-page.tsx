"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CalendarPlus, Info } from "lucide-react";
import { managersOptions } from "@/entities/manager";
import { MeetingEditor } from "@/features/manage-meeting";
import { ScheduleBoard } from "@/widgets/schedule";
import { almatyDate } from "@/shared/lib/datetime";
import { Button, ErrorNotice, Loading } from "@/shared/ui";

function ScheduleContent() {
  const params = useSearchParams() ?? new URLSearchParams();
  const router = useRouter();
  const managers = useQuery(managersOptions);
  const dayParam = z.iso.date().safeParse(params.get("date"));
  const date = dayParam.success && dayParam.data >= "1900-01-01" && dayParam.data <= "2100-12-31" ? dayParam.data : almatyDate();
  const selected = managers.data?.find((item) => item.id === Number(params.get("manager"))) ?? managers.data?.[0];
  const [editorTime, setEditorTime] = useState<string | null>(null);
  function update(day: string, manager = selected?.id) {
    const next = new URLSearchParams({ date: day });
    if (manager) next.set("manager", String(manager));
    router.replace(`/schedule?${next}`, { scroll: false });
  }
  return <><div className="page-header"><div><p className="eyebrow">Планирование команды</p><h1 className="page-title">Расписание</h1><p className="page-subtitle">Нужные люди. Удобное время. Никаких накладок.</p></div>
    <Button aria-label="Назначить встречу" disabled={!selected} onClick={() => setEditorTime("10:00")}><CalendarPlus size={16} />Назначить встречу</Button></div>
    <div className="mb-5 flex items-center gap-3"><label htmlFor="schedule-manager" className="meeting-meta">Менеджер</label>
      <select id="schedule-manager" className="input manager-select" value={selected?.id ?? 0} onChange={(event) => update(date, Number(event.target.value))} disabled={managers.isPending || !managers.data?.length}>
        {!managers.data?.length && <option value={0}>{managers.isPending ? "Загружаем…" : "Нет менеджеров"}</option>}
        {managers.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select></div>
    {managers.isError && <ErrorNotice error={managers.error} retry={() => void managers.refetch()} />}
    <ScheduleBoard date={date} managerId={selected?.id ?? 0} managerName={selected?.name ?? ""} onDate={(value) => update(value)} onCreate={setEditorTime} />
    <p className="bottom-note"><Info size={12} />Одна встреча — один час. Рабочие дни: понедельник–пятница, 09:00–18:00.</p>
    {editorTime && <MeetingEditor date={date} time={editorTime} managerId={selected?.id} onClose={() => setEditorTime(null)} />}
  </>;
}
export function SchedulePage() { return <Suspense fallback={<Loading />}><ScheduleContent /></Suspense>; }
