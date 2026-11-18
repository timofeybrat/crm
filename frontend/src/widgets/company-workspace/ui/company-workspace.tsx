"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CalendarPlus, Clock3, History, Phone, Repeat2 } from "lucide-react";
import {
  CompanyAvatar,
  CompanyStatusBadge,
  companyLabels,
  useCompanyPanel,
} from "@/entities/company";
import { managersOptions } from "@/entities/manager";
import type { Meeting } from "@/entities/meeting";
import { MeetingActions, MeetingEditor } from "@/features/manage-meeting";
import { RecordCallForm } from "@/features/record-call";
import { almatyTime, formatDate } from "@/shared/lib/datetime";
import { Button, ErrorNotice, Loading, Modal } from "@/shared/ui";
import { workspaceOptions } from "../model/query";
import { MeetingHistory } from "./meeting-history";

function Workspace({ id, onClose }: { id: number; onClose: () => void }) {
  const query = useQuery(workspaceOptions(id));
  const managers = useQuery(managersOptions);
  const [tab, setTab] = useState<"calls" | "meetings">("calls");
  const [editor, setEditor] = useState<"new" | Meeting | null>(null);
  const [history, setHistory] = useState<number | null>(null);
  const company = query.data;
  const active = company?.active_meeting;
  function managerName(managerId: number) {
    return managers.data?.find((item) => item.id === managerId)?.name ?? `Менеджер #${managerId}`;
  }
  return (
    <Modal
      open
      side
      onClose={onClose}
      title="Карточка организации"
      description="Контакты, звонки и встречи — рядом."
    >
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        company && (
          <>
            <div className="detail-identity">
              <CompanyAvatar name={company.name} id={id} />
              <div>
                <div className="detail-identity-name">{company.name}</div>
                <p className="meeting-meta">Организация в вашей базе</p>
              </div>
            </div>
            <dl className="detail-facts">
              <div>
                <dt>БИН</dt>
                <dd className="mono">{company.bin}</dd>
              </div>
              <div>
                <dt>Телефон</dt>
                <dd>
                  <a className="phone-link" href={`tel:${company.phone}`}>
                    {company.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt>В базе с</dt>
                <dd>{formatDate(company.created_at, { year: "numeric" })}</dd>
              </div>
              <div>
                <dt>Последний результат звонка</dt>
                <dd>
                  <CompanyStatusBadge status={company.status} />
                </dd>
              </div>
            </dl>
            <p className="section-label">Активная встреча</p>
            {active ? (
              <div className="meeting-card">
                <div className="meeting-card-top">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={13} />
                    Запланирована
                  </span>
                  <button className="text-link" onClick={() => setHistory(active.id)}>
                    История
                  </button>
                </div>
                <div className="meeting-date">
                  {formatDate(active.starts_at, { month: "long" })}{" "}
                  <span className="font-normal text-slate-400">·</span>{" "}
                  {almatyTime(active.starts_at)}–{almatyTime(active.ends_at)}
                </div>
                <div className="meeting-meta">{managerName(active.manager_id)} · время Алматы</div>
                <div className="meeting-actions">
                  <Button
                    variant="ghost"
                    className="button-small"
                    onClick={() => setEditor(active)}
                  >
                    <Repeat2 size={13} />
                    Перенести
                  </Button>
                  <MeetingActions meeting={active} />
                </div>
              </div>
            ) : (
              <div className="meeting-card">
                <div className="meeting-meta">Активных встреч пока нет</div>
                <Button
                  variant="secondary"
                  className="button-small mt-3"
                  onClick={() => setEditor("new")}
                >
                  <CalendarPlus size={14} />
                  Назначить встречу
                </Button>
              </div>
            )}
            <div
              className="detail-tabs"
              role="tablist"
              aria-label="История организации"
              onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next =
                  event.key === "Home"
                    ? "calls"
                    : event.key === "End"
                      ? "meetings"
                      : tab === "calls"
                        ? "meetings"
                        : "calls";
                setTab(next);
                event.currentTarget.querySelector<HTMLButtonElement>(`#${next}-tab`)?.focus();
              }}
            >
              <button
                id="calls-tab"
                role="tab"
                aria-selected={tab === "calls"}
                tabIndex={tab === "calls" ? 0 : -1}
                aria-controls="calls-panel"
                className={`detail-tab ${tab === "calls" ? "detail-tab-active" : ""}`}
                onClick={() => setTab("calls")}
              >
                Звонки
              </button>
              <button
                id="meetings-tab"
                role="tab"
                aria-selected={tab === "meetings"}
                tabIndex={tab === "meetings" ? 0 : -1}
                aria-controls="meetings-panel"
                className={`detail-tab ${tab === "meetings" ? "detail-tab-active" : ""}`}
                onClick={() => setTab("meetings")}
              >
                Встречи
              </button>
            </div>
            {tab === "calls" ? (
              <section id="calls-panel" role="tabpanel" aria-labelledby="calls-tab">
                <RecordCallForm
                  company={company}
                  meeting={active ?? null}
                  onSchedule={() => setEditor("new")}
                />
                <p className="section-label">
                  Последние звонки <span className="normal-case font-normal">· до 10 записей</span>
                </p>
                {company.recent_calls.length === 0 ? (
                  <p className="meeting-meta">Здесь появятся сохранённые результаты звонков.</p>
                ) : (
                  company.recent_calls.map((call) => (
                    <div className="activity-item" key={call.id}>
                      <span className="activity-icon">
                        <Phone size={13} />
                      </span>
                      <div>
                        <div className="activity-title">{companyLabels[call.result]}</div>
                        <div className="activity-caption">
                          {formatDate(call.created_at, { year: "numeric" })} ·{" "}
                          {almatyTime(call.created_at)}
                          {call.meeting_id && (
                            <>
                              {" "}
                              ·{" "}
                              <button
                                className="text-link"
                                onClick={() => setHistory(call.meeting_id!)}
                              >
                                Связанная встреча
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </section>
            ) : (
              <section id="meetings-panel" role="tabpanel" aria-labelledby="meetings-tab">
                <p className="section-label">Последние 10 встреч</p>
                {company.recent_meetings.length === 0 ? (
                  <p className="meeting-meta">Назначенные встречи появятся здесь.</p>
                ) : (
                  company.recent_meetings.map((meeting) => (
                    <div className="activity-item" key={meeting.id}>
                      <span className="activity-icon">
                        <CalendarDays size={14} />
                      </span>
                      <div className="flex-1">
                        <div className="activity-title">
                          {formatDate(meeting.starts_at, { month: "long" })},{" "}
                          {almatyTime(meeting.starts_at)}–{almatyTime(meeting.ends_at)}
                        </div>
                        <div className="activity-caption">
                          {managerName(meeting.manager_id)} ·{" "}
                          {meeting.status === "scheduled"
                            ? "Запланирована"
                            : meeting.status === "cancelled"
                              ? "Отменена"
                              : "Завершена"}
                        </div>
                      </div>
                      <button
                        className="icon-button"
                        title="История встречи"
                        aria-label={`История встречи ${formatDate(meeting.starts_at)}`}
                        onClick={() => setHistory(meeting.id)}
                      >
                        <History size={16} />
                      </button>
                    </div>
                  ))
                )}
              </section>
            )}
            <p className="bottom-note">
              <Clock3 size={12} />
              Все даты и время показаны по Алматы.
            </p>
            {editor && (
              <MeetingEditor
                company={company}
                meeting={editor === "new" ? undefined : editor}
                onClose={() => setEditor(null)}
              />
            )}
            {history && <MeetingHistory id={history} onClose={() => setHistory(null)} />}
          </>
        )
      )}
    </Modal>
  );
}

export function CompanyWorkspace() {
  const id = useCompanyPanel((state) => state.activeId);
  const close = useCompanyPanel((state) => state.close);
  return id ? <Workspace key={id} id={id} onClose={close} /> : null;
}
