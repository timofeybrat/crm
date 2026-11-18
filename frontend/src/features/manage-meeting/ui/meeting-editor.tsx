"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CalendarPlus, Clock3, CheckCircle2 } from "lucide-react";
import { CompanyPicker, companyKeys, type Company } from "@/entities/company";
import { managersOptions } from "@/entities/manager";
import { createMeeting, updateMeeting, scheduleOptions, meetingKeys, type Meeting, type MeetingDetail } from "@/entities/meeting";
import { recordCall } from "@/entities/call";
import { almatyDate, almatyTime, isWeekday, localToUtc } from "@/shared/lib/datetime";
import { Button, ErrorNotice, Field, Modal, useToast } from "@/shared/ui";

const schema = z.object({
  date: z.iso.date({ error: "Выберите дату" }).refine(isWeekday, "Выберите будний день: понедельник–пятница"),
  time: z.string().regex(/^(09|1[0-7]):[0-5][0-9]$/, "Выберите время встречи").refine((v) => v <= "17:00", "Последнее начало — в 17:00"),
  managerId: z.number().int().min(1, "Выберите менеджера"),
  saveCall: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function MeetingEditor({ company: initialCompany, meeting, date, time, managerId, onClose }: {
  company?: Company; meeting?: Meeting; date?: string; time?: string; managerId?: number; onClose: () => void;
}) {
  const [company, setCompany] = useState<Company | null>(initialCompany ?? null);
  const [companyError, setCompanyError] = useState(false);
  const [created, setCreated] = useState<MeetingDetail | null>(null);
  const [partialError, setPartialError] = useState<unknown>(null);
  const cache = useQueryClient();
  const notify = useToast();
  const managers = useQuery(managersOptions);
  const form = useForm<Values>({ resolver: zodResolver(schema), defaultValues: {
    date: meeting ? almatyDate(meeting.starts_at) : date ?? almatyDate(),
    time: meeting ? almatyTime(meeting.starts_at) : time ?? "10:00",
    managerId: meeting?.manager_id ?? managerId ?? 0, saveCall: true,
  }});
  const selectedDate = useWatch({ control: form.control, name: "date" });
  const selectedManager = useWatch({ control: form.control, name: "managerId" });
  const selectedTime = useWatch({ control: form.control, name: "time" });
  useEffect(() => {
    if (!form.getValues("managerId") && managers.data?.[0]) form.setValue("managerId", managers.data[0].id);
  }, [managers.data, form]);
  const availability = useQuery(scheduleOptions(selectedManager, z.iso.date().safeParse(selectedDate).success ? selectedDate : ""));
  function busyAt(value: string) {
    if (!z.iso.date().safeParse(selectedDate).success) return false;
    const start = Date.parse(localToUtc(selectedDate, value));
    return availability.data?.meetings.some((item) => item.id !== meeting?.id && Date.parse(item.starts_at) < start + 3600000 && Date.parse(item.ends_at) > start) ?? false;
  }
  async function invalidate() {
    await Promise.all([companyKeys.all, meetingKeys.all, meetingKeys.schedules].map((queryKey) => cache.invalidateQueries({ queryKey })));
  }
  function finish(message: string) { notify(message); onClose(); }
  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      const starts_at = localToUtc(values.date, values.time);
      if (meeting) return { meeting: await updateMeeting(meeting.id, { action: "reschedule", starts_at, manager_id: values.managerId }) };
      const result = await createMeeting({ company_id: company!.id, manager_id: values.managerId, starts_at });
      setCreated(result);
      if (values.saveCall) {
        try { await recordCall({ company_id: result.company_id, result: "meeting_set", meeting_id: result.id }); }
        catch (error) { return { meeting: result, callError: error }; }
      }
      return { meeting: result };
    },
    onSuccess: async (result) => {
      await invalidate();
      if (result.callError) setPartialError(result.callError);
      else finish(meeting ? "Встреча перенесена, история сохранена" : "Встреча назначена");
    },
    onError: () => { void cache.invalidateQueries({ queryKey: meetingKeys.schedules }); },
  });
  const retry = useMutation({ mutationFn: async () => recordCall({ company_id: created!.company_id, result: "meeting_set", meeting_id: created!.id }),
    onSuccess: async () => { await invalidate(); finish("Встреча и результат звонка сохранены"); },
  });
  const pending = mutation.isPending || retry.isPending;
  const times = Array.from({ length: 17 }, (_, index) => `${String(9 + Math.floor(index / 2)).padStart(2, "0")}:${index % 2 ? "30" : "00"}`);
  if (selectedTime && !times.includes(selectedTime)) times.push(selectedTime);
  return <Modal open onClose={onClose} title={meeting ? "Перенести встречу" : "Назначить встречу"}
    description="Выберите удобное время. Длительность встречи — 60 минут." busy={pending}>
    {created && partialError ? <>
      <div className="info-box"><CheckCircle2 size={18} /><div><strong>Встреча уже создана</strong><br />Не удалось сохранить результат звонка. Встреча останется в расписании — повторно назначать её не нужно.</div></div>
      <ErrorNotice error={retry.error ?? partialError} />
      <div className="form-footer"><Button variant="secondary" disabled={pending} onClick={onClose}>Закрыть</Button><Button loading={retry.isPending} onClick={() => retry.mutate()}>Повторить запись звонка</Button></div>
    </> : <form noValidate onSubmit={form.handleSubmit((values) => {
      if (!company && !meeting) { setCompanyError(true); return; }
      if (busyAt(values.time)) { form.setError("time", { message: "Это время уже занято. Выберите свободный слот." }); return; }
      mutation.mutate(values);
    })}>
      <fieldset disabled={pending}>
        {initialCompany ? <div className="info-box"><strong>{initialCompany.name}</strong><span className="mono">{initialCompany.bin}</span></div>
          : <Field label="Организация" htmlFor="meeting-company" error={companyError ? "Выберите организацию из списка" : undefined}>
            <CompanyPicker id="meeting-company" value={company} onChange={(value) => { setCompany(value); setCompanyError(false); }} />
          </Field>}
        <Field label="Менеджер" htmlFor="meeting-manager" error={form.formState.errors.managerId?.message}>
          <select id="meeting-manager" className="input" aria-invalid={!!form.formState.errors.managerId} {...form.register("managerId", { valueAsNumber: true })}>
            <option value={0}>Выберите менеджера</option>{managers.data?.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </Field>
        {managers.isError && <ErrorNotice error={managers.error} retry={() => void managers.refetch()} />}
        {managers.data?.length === 0 && <ErrorNotice error="В списке пока нет менеджеров. Назначение будет доступно, когда они появятся." />}
        <div className="form-grid">
          <Field label="Дата" htmlFor="meeting-date" error={form.formState.errors.date?.message}>
            <input id="meeting-date" className="input" type="date" min="1900-01-01" max="2100-12-31" aria-invalid={!!form.formState.errors.date} {...form.register("date")} />
          </Field>
          <Field label="Время, Алматы" htmlFor="meeting-time" error={form.formState.errors.time?.message}>
            <select id="meeting-time" className="input" aria-invalid={!!form.formState.errors.time} {...form.register("time")}>
              {times.sort().map((value) => <option key={value} value={value} disabled={busyAt(value)}>{value}{busyAt(value) ? " · занято" : ""}</option>)}
            </select>
          </Field>
        </div>
        <div className="info-box"><Clock3 size={16} /><span>Понедельник–пятница, 09:00–18:00 по Алматы.<br />Последний часовой слот начинается в 17:00.</span></div>
        {!meeting && <label className="checkbox-label"><input type="checkbox" {...form.register("saveCall")} /><span>Также записать результат звонка «Встреча назначена»</span></label>}
      </fieldset>
      {mutation.isError && <ErrorNotice error={mutation.error} />}
      <div className="form-footer"><Button variant="secondary" disabled={pending} onClick={onClose}>Отмена</Button>
        <Button type="submit" loading={pending} disabled={managers.isPending || managers.isError || !managers.data?.length}><CalendarPlus size={16} />{meeting ? "Сохранить перенос" : "Назначить встречу"}</Button></div>
    </form>}
  </Modal>;
}
