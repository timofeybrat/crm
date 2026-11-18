"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { CalendarPlus, Info } from "lucide-react";
import { managersOptions } from "@/entities/manager";
import { useSession } from "@/entities/session";
import { MeetingEditor } from "@/features/manage-meeting";
import { ScheduleBoard } from "@/widgets/schedule";
import { almatyDate } from "@/shared/lib/datetime";
import { Button, ErrorNotice, Loading } from "@/shared/ui";

function ScheduleContent() {
  const { user } = useSession();
  const params = useSearchParams() ?? new URLSearchParams();
  const managers = useQuery(managersOptions);
  const dayParam = z.iso.date().safeParse(params.get("date"));
  const date =
    dayParam.success && dayParam.data >= "1900-01-01" && dayParam.data <= "2100-12-31"
      ? dayParam.data
      : almatyDate();
  const selected =
    managers.data?.find((item) => item.id === Number(params.get("manager"))) ??
    managers.data?.find((item) => item.id === user?.manager_id) ??
    managers.data?.[0];
  const [editorTime, setEditorTime] = useState<string | null>(null);
  function update(values: { date?: string; manager?: number }) {
    const next = new URLSearchParams(window.location.search);
    if (!next.has("date")) next.set("date", date);
    if (!next.has("manager") && selected) next.set("manager", String(selected.id));
    for (const [key, value] of Object.entries(values)) next.set(key, String(value));
    window.history.replaceState(null, "", `/schedule?${next}`);
  }
  return (
    <>
      <div className="page-header">
        <div>
          <p className="eyebrow">Планирование команды</p>
          <h1 className="page-title">Расписание</h1>
          <p className="page-subtitle">Нужные люди. Удобное время. Никаких накладок.</p>
        </div>
        <Button
          aria-label="Назначить встречу"
          disabled={!selected || (user?.role !== "admin" && user?.manager_id !== selected.id)}
          onClick={() => setEditorTime("10:00")}
        >
          <CalendarPlus size={16} />
          Назначить встречу
        </Button>
      </div>
      <div className="mb-5 flex items-center gap-3">
        <label htmlFor="schedule-manager" className="meeting-meta">
          Менеджер
        </label>
        <select
          id="schedule-manager"
          className="input manager-select"
          value={selected?.id ?? 0}
          onChange={(event) => update({ manager: Number(event.target.value) })}
          disabled={managers.isPending || !managers.data?.length}
        >
          {!managers.data?.length && (
            <option value={0}>{managers.isPending ? "Загружаем…" : "Нет менеджеров"}</option>
          )}
          {managers.data?.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </div>
      {managers.isError && (
        <ErrorNotice error={managers.error} retry={() => void managers.refetch()} />
      )}
      <ScheduleBoard
        date={date}
        managerId={selected?.id ?? 0}
        managerName={selected?.name ?? ""}
        onDate={(value) => update({ date: value })}
        onCreate={setEditorTime}
      />
      <p className="bottom-note">
        <Info size={12} />
        Одна встреча — один час. Рабочие дни: понедельник–пятница, 09:00–18:00.
      </p>
      {editorTime && (
        <MeetingEditor
          date={date}
          time={editorTime}
          managerId={selected?.id}
          onClose={() => setEditorTime(null)}
        />
      )}
    </>
  );
}
export function SchedulePage() {
  return (
    <Suspense fallback={<Loading />}>
      <ScheduleContent />
    </Suspense>
  );
}
