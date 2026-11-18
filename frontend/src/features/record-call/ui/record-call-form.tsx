"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { CalendarCheck, PhoneMissed, PhoneOff, Phone, ArrowRight } from "lucide-react";
import { companyKeys, type Company } from "@/entities/company";
import { recordCall, type CallResult } from "@/entities/call";
import type { Meeting } from "@/entities/meeting";
import { almatyTime, formatDate } from "@/shared/lib/datetime";
import { Button, ErrorNotice, useToast } from "@/shared/ui";

const schema = z.object({ result: z.enum(["no_answer", "refused", "meeting_set"]) });
const outcomes = [
  { value: "no_answer", label: "Не ответили", Icon: PhoneMissed },
  { value: "refused", label: "Отказ", Icon: PhoneOff },
  { value: "meeting_set", label: "Встреча назначена", Icon: CalendarCheck },
] as const;

export function RecordCallForm({ company, meeting, onSchedule }: { company: Company; meeting: Meeting | null; onSchedule: () => void }) {
  const cache = useQueryClient();
  const notify = useToast();
  const form = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema), defaultValues: { result: "no_answer" } });
  const result = form.watch("result");
  const mutation = useMutation({ mutationFn: (value: CallResult) => recordCall({ company_id: company.id, result: value,
    ...(value === "meeting_set" && meeting ? { meeting_id: meeting.id } : {}),
  }), onSuccess: async () => { await cache.invalidateQueries({ queryKey: companyKeys.all }); notify("Результат звонка сохранён"); } });
  return <form noValidate onSubmit={form.handleSubmit((data) => mutation.mutate(data.result))}>
    <p className="section-label">Чем закончился звонок?</p>
    <div className="outcome-options" role="radiogroup" aria-label="Результат звонка">
      {outcomes.map(({ value, label, Icon }) => <label key={value}
        className={`outcome-button ${result === value ? "outcome-selected" : ""}`}>
        <input type="radio" className="sr-only" value={value} disabled={mutation.isPending}
          {...form.register("result", { onChange: () => mutation.reset() })} /><Icon size={19} />{label}</label>)}
    </div>
    {result === "meeting_set" && (meeting ? <div className="info-box"><CalendarCheck size={17} /><span>Результат будет связан со встречей<br /><strong>{formatDate(meeting.starts_at)} в {almatyTime(meeting.starts_at)} · Алматы</strong></span></div>
      : <div className="info-box"><CalendarCheck size={17} /><div>Сначала назначьте встречу — результат звонка сохранится вместе с ней.<br />
        <Button variant="ghost" className="button-small" onClick={onSchedule}>Назначить встречу <ArrowRight size={13} /></Button></div></div>)}
    {mutation.isError && <ErrorNotice error={mutation.error} />}
    <Button type="submit" className="w-full" loading={mutation.isPending} disabled={result === "meeting_set" && !meeting}><Phone size={15} />Сохранить результат</Button>
  </form>;
}
