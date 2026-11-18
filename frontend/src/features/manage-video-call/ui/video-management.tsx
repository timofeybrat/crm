"use client";

import { useRef, useState } from "react";
import { Copy, Link2, Video, X } from "lucide-react";
import {
  closeVideoRoom,
  createVideoRoom,
  inviteVideoGuest,
  type VideoRoomInfo,
} from "@/entities/video-call";
import { Button, ErrorNotice, Modal, useToast } from "@/shared/ui";

export function VideoManagement({
  room,
  managerKey,
  onChange,
  onClosed,
}: {
  room: VideoRoomInfo;
  managerKey: string;
  onChange: (room: VideoRoomInfo) => void;
  onClosed: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const guard = useRef(false);
  const [error, setError] = useState<unknown>(null);
  const [invitation, setInvitation] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const notify = useToast();

  async function perform(action: "create" | "invite" | "close") {
    if (guard.current) return;
    guard.current = true;
    setBusy(true);
    setError(null);
    try {
      if (action === "create") onChange(await createVideoRoom(room.meeting_id, managerKey));
      if (action === "invite") {
        const result = await inviteVideoGuest(room.meeting_id, managerKey);
        setInvitation(result.url);
        notify("Приглашение готово. Предыдущая ссылка больше не действует для входа.");
      }
      if (action === "close") {
        await closeVideoRoom(room.meeting_id, managerKey);
        setInvitation("");
        setConfirmClose(false);
        onClosed();
        onChange({ ...room, closed: true });
        notify("Созвон завершён. Статус встречи CRM сохранён.");
      }
    } catch (err) {
      setError(err);
    } finally {
      guard.current = false;
      setBusy(false);
    }
  }

  async function copyInvitation() {
    try {
      await navigator.clipboard.writeText(invitation);
      notify("Ссылка скопирована");
    } catch {
      notify("Выделите и скопируйте ссылку из поля ниже.");
    }
  }

  return (
    <section className="video-management" aria-label="Управление созвоном">
      <div className="video-management-actions">
        {!room.room_exists && !room.closed && (
          <Button loading={busy} onClick={() => void perform("create")}>
            <Video size={16} />
            Создать комнату
          </Button>
        )}
        {room.room_exists && !room.closed && (
          <>
            <Button variant="secondary" disabled={busy} onClick={() => void perform("invite")}>
              <Link2 size={16} />
              {invitation ? "Заменить приглашение" : "Пригласить гостя"}
            </Button>
            <Button variant="danger" disabled={busy} onClick={() => setConfirmClose(true)}>
              <X size={16} />
              Завершить созвон
            </Button>
          </>
        )}
      </div>
      {invitation && (
        <div className="video-invitation">
          <label htmlFor="guest-invitation">Личная ссылка гостя</label>
          <div>
            <input
              id="guest-invitation"
              readOnly
              value={invitation}
              onFocus={(e) => e.target.select()}
            />
            <Button variant="secondary" onClick={() => void copyInvitation()}>
              <Copy size={15} />
              Копировать
            </Button>
          </div>
          <p>Доступна до конца окна встречи. Передавайте ссылку только участнику.</p>
        </div>
      )}
      {error != null && <ErrorNotice error={error} />}
      {confirmClose && (
        <Modal
          open
          title="Завершить созвон для всех?"
          onClose={() => setConfirmClose(false)}
          busy={busy}
        >
          <p className="meeting-meta">
            Новые подключения будут запрещены. Участники отключатся после обработки запроса
            медиасервером. Эта комната больше не откроется; встреча CRM останется в своём текущем
            статусе.
          </p>
          <div className="form-footer">
            <Button variant="secondary" disabled={busy} onClick={() => setConfirmClose(false)}>
              Вернуться
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void perform("close")}>
              Да, завершить созвон
            </Button>
          </div>
        </Modal>
      )}
    </section>
  );
}
