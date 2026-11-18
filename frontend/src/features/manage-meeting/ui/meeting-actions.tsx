"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { companyKeys } from "@/entities/company";
import { meetingKeys, updateMeeting, type Meeting } from "@/entities/meeting";
import { Button, ErrorNotice, Modal, useToast } from "@/shared/ui";
import { formatDate, almatyTime } from "@/shared/lib/datetime";
import { useNow } from "@/shared/lib/use-now";

export function MeetingActions({ meeting }: { meeting: Meeting }) {
  const [action, setAction] = useState<"cancel" | "complete" | null>(null);
  const cache = useQueryClient();
  const notify = useToast();
  const now = useNow();
  const mutation = useMutation({
    mutationFn: (value: "cancel" | "complete") => updateMeeting(meeting.id, { action: value }),
    onSuccess: async (_, value) => {
      await Promise.all(
        [companyKeys.all, meetingKeys.all, meetingKeys.schedules].map((queryKey) =>
          cache.invalidateQueries({ queryKey }),
        ),
      );
      notify(value === "cancel" ? "Встреча отменена, слот свободен" : "Встреча завершена");
      setAction(null);
    },
  });
  if (meeting.status !== "scheduled") return null;
  return (
    <>
      {Date.parse(meeting.ends_at) <= now && (
        <Button
          variant="ghost"
          className="button-small"
          onClick={() => {
            mutation.reset();
            setAction("complete");
          }}
        >
          <Check size={13} />
          Завершить
        </Button>
      )}
      <Button
        variant="ghost"
        className="button-small"
        onClick={() => {
          mutation.reset();
          setAction("cancel");
        }}
      >
        <X size={13} />
        Отменить
      </Button>
      {action && (
        <Modal
          open
          onClose={() => setAction(null)}
          title={action === "cancel" ? "Отменить встречу?" : "Завершить встречу?"}
          busy={mutation.isPending}
          description={`${formatDate(meeting.starts_at, { month: "long" })}, ${almatyTime(meeting.starts_at)}–${almatyTime(meeting.ends_at)} · Алматы`}
        >
          <p className="meeting-meta">
            {action === "cancel"
              ? "Встреча исчезнет из активного расписания, а её история сохранится. Организации можно будет назначить новую встречу."
              : "Встреча будет отмечена как завершённая. История сохранится, и организации можно будет назначить следующую встречу."}
          </p>
          {mutation.isError && <ErrorNotice error={mutation.error} />}
          <div className="form-footer">
            <Button
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => setAction(null)}
            >
              Вернуться
            </Button>
            <Button
              variant={action === "cancel" ? "danger" : "primary"}
              loading={mutation.isPending}
              onClick={() => mutation.mutate(action)}
            >
              {action === "cancel" ? "Да, отменить" : "Завершить встречу"}
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
