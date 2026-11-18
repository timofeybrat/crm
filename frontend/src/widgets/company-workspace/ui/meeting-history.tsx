"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CalendarDays, Check, History, X } from "lucide-react";
import { meetingOptions } from "@/entities/meeting";
import { managersOptions } from "@/entities/manager";
import { almatyTime, formatDate } from "@/shared/lib/datetime";
import { ErrorNotice, Loading, Modal } from "@/shared/ui";

const actions = {
  create: "Встреча назначена",
  reschedule: "Встреча перенесена",
  cancel: "Встреча отменена",
  complete: "Встреча завершена",
};
export function MeetingHistory({ id, onClose }: { id: number; onClose: () => void }) {
  const query = useQuery(meetingOptions(id));
  const managers = useQuery(managersOptions);
  function managerName(managerId: number) {
    return managers.data?.find((item) => item.id === managerId)?.name ?? `Менеджер #${managerId}`;
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="История встречи"
      description="Все изменения, от первого назначения до завершения."
    >
      {query.isPending ? (
        <Loading />
      ) : query.isError ? (
        <ErrorNotice error={query.error} retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="info-box">
            <History size={17} />
            <div>
              Изначально назначена на
              <br />
              <strong>
                {formatDate(query.data.original_starts_at, { year: "numeric" })},{" "}
                {almatyTime(query.data.original_starts_at)} · Алматы
              </strong>
            </div>
          </div>
          {[...query.data.history].reverse().map((item) => (
            <div key={item.id} className="activity-item">
              <span className="activity-icon">
                {item.action === "cancel" ? (
                  <X size={14} />
                ) : item.action === "complete" ? (
                  <Check size={14} />
                ) : (
                  <CalendarDays size={14} />
                )}
              </span>
              <div>
                <div className="activity-title">{actions[item.action]}</div>
                {item.action === "reschedule" && item.old_starts_at && (
                  <div className="activity-caption">
                    {formatDate(item.old_starts_at)} · {almatyTime(item.old_starts_at)}{" "}
                    <ArrowRight size={10} className="inline" /> {formatDate(item.new_starts_at)} ·{" "}
                    {almatyTime(item.new_starts_at)}
                    <br />
                    {managerName(item.old_manager_id!)} → {managerName(item.new_manager_id)}
                  </div>
                )}
                {item.action === "create" && (
                  <div className="activity-caption">
                    {formatDate(item.new_starts_at)} · {almatyTime(item.new_starts_at)}–
                    {almatyTime(item.new_ends_at)}
                    <br />
                    {managerName(item.new_manager_id)}
                  </div>
                )}
                <div className="activity-caption">
                  Изменение: {formatDate(item.occurred_at, { year: "numeric" })},{" "}
                  {almatyTime(item.occurred_at)}
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </Modal>
  );
}
