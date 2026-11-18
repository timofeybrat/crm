"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus } from "lucide-react";
import { useCompanyPanel } from "@/entities/company";
import { scheduleOptions } from "@/entities/meeting";
import {
  almatyDate,
  almatyTime,
  formatDate,
  isWeekday,
  localToUtc,
  minuteOfDay,
  shiftDay,
} from "@/shared/lib/datetime";
import { Button, ErrorNotice, Loading } from "@/shared/ui";
import { plural } from "@/shared/lib/plural";

export function ScheduleBoard({
  date,
  managerId,
  managerName,
  onDate,
  onCreate,
}: {
  date: string;
  managerId: number;
  managerName: string;
  onDate: (date: string) => void;
  onCreate: (time: string) => void;
}) {
  const query = useQuery(scheduleOptions(managerId, date));
  const open = useCompanyPanel((state) => state.open);
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  const monday = shiftDay(date, -((weekday + 6) % 7));
  const meetings = query.data?.meetings ?? [];
  function isBusy(time: string) {
    const start = Date.parse(localToUtc(date, time));
    return meetings.some(
      (item) => Date.parse(item.starts_at) < start + 3600000 && Date.parse(item.ends_at) > start,
    );
  }
  return (
    <div className="surface">
      <div className="schedule-controls">
        <div className="day-picker">
          <button
            className="icon-button"
            aria-label="Предыдущий день"
            onClick={() => onDate(shiftDay(date, -1))}
          >
            <ChevronLeft size={17} />
          </button>
          <input
            aria-label="Дата расписания"
            type="date"
            className="input"
            min="1900-01-01"
            max="2100-12-31"
            value={date}
            onChange={(event) => {
              if (event.target.value) onDate(event.target.value);
            }}
          />
          <button
            className="icon-button"
            aria-label="Следующий день"
            onClick={() => onDate(shiftDay(date, 1))}
          >
            <ChevronRight size={17} />
          </button>
          <Button variant="ghost" className="button-small" onClick={() => onDate(almatyDate())}>
            Сегодня
          </Button>
        </div>
        <span className="meeting-meta inline-flex items-center gap-1.5">
          <Clock3 size={13} />
          Время Алматы
        </span>
      </div>
      <div className="week-strip" aria-label="Неделя">
        {Array.from({ length: 7 }, (_, index) => shiftDay(monday, index)).map((day) => (
          <button
            key={day}
            aria-pressed={day === date}
            className={`week-day ${!isWeekday(day) ? "week-day-weekend" : ""} ${day === date ? "week-day-active" : ""}`}
            onClick={() => onDate(day)}
          >
            <span>{formatDate(day, { weekday: "short", day: undefined, month: undefined })}</span>
            <strong>{Number(day.slice(-2))}</strong>
          </button>
        ))}
      </div>
      {!managerId ? (
        <div className="empty-state">
          <div className="empty-icon">
            <CalendarDays size={22} />
          </div>
          <h3>Выберите менеджера</h3>
          <p>Его встречи появятся в расписании.</p>
        </div>
      ) : query.isPending ? (
        <Loading label="Загружаем расписание…" />
      ) : query.isError ? (
        <div className="p-6">
          <ErrorNotice error={query.error} retry={() => void query.refetch()} />
        </div>
      ) : (
        <>
          <div className="schedule-meta">
            <strong>
              {managerName}{" "}
              <span className="count-pill">
                {meetings.length} {plural(meetings.length, ["встреча", "встречи", "встреч"])}
              </span>
            </strong>
            <span>{formatDate(date, { month: "long" })} · 60 минут</span>
          </div>
          <div className="timeline" aria-label="Встречи на день">
            {Array.from({ length: 10 }, (_, index) => 9 + index).map((hour, index) => (
              <div
                key={hour}
                className="timeline-hour"
                style={{ top: index * 72, height: hour === 18 ? 0 : 72 }}
              >
                <span>{String(hour).padStart(2, "0")}:00</span>
                {hour < 18 && (
                  <button
                    className="timeline-add"
                    disabled={!isWeekday(date) || isBusy(`${String(hour).padStart(2, "0")}:00`)}
                    aria-label={`Назначить встречу на ${String(hour).padStart(2, "0")}:00`}
                    onClick={() => onCreate(`${String(hour).padStart(2, "0")}:00`)}
                  >
                    <Plus size={12} className="inline mr-1" />
                    Назначить встречу
                  </button>
                )}
              </div>
            ))}
            {meetings.map((meeting) => (
              <button
                className="timeline-meeting"
                key={meeting.id}
                style={{ top: (minuteOfDay(meeting.starts_at) - 540) * 1.2 + 3, height: 66 }}
                onClick={() => open(meeting.company_id)}
                aria-label={`${meeting.company_name}, ${almatyTime(meeting.starts_at)}–${almatyTime(meeting.ends_at)}. Открыть организацию`}
              >
                <span className="timeline-time">
                  {almatyTime(meeting.starts_at)}
                  <br />
                  <span className="font-normal opacity-60">{almatyTime(meeting.ends_at)}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="timeline-company">{meeting.company_name}</div>
                  <div className="timeline-caption">Встреча с организацией · 60 минут</div>
                </div>
                <ChevronRight size={15} className="shrink-0" />
              </button>
            ))}
          </div>
          <div className="schedule-empty-hint">
            {!isWeekday(date)
              ? "Выходной день. Встречи назначаются с понедельника по пятницу."
              : meetings.length === 0
                ? "Пока свободно. Нажмите на час в расписании, чтобы назначить встречу."
                : "Нажмите на встречу, чтобы открыть контакты, перенести её или посмотреть историю."}
          </div>
        </>
      )}
    </div>
  );
}
