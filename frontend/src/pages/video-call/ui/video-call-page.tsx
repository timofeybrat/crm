"use client";

import { useEffect, useRef, useState } from "react";
import { Activity, ArrowLeft, CalendarDays, LockKeyhole, ShieldCheck, Video } from "lucide-react";
import Link from "next/link";
import {
  getGuestRoom,
  getVideoRoom,
  type VideoAccess,
  type VideoRoomInfo,
} from "@/entities/video-call";
import { VideoManagement } from "@/features/manage-video-call";
import { VideoRoom, type RoomProviderComponent } from "@/widgets/video-room";
import { Button, ErrorNotice, Field } from "@/shared/ui";
import { almatyTime, formatDate } from "@/shared/lib/datetime";
import { useNow } from "@/shared/lib/use-now";
import { ApiError } from "@/shared/api";

export function VideoCallPage({
  meetingId,
  RoomProvider,
}: {
  meetingId?: number;
  RoomProvider: RoomProviderComponent;
}) {
  const guest = meetingId === undefined;
  const [invitation, setInvitation] = useState(() =>
    guest ? (new URLSearchParams(window.location.hash.slice(1)).get("invite") ?? "") : "",
  );
  const [managerKey, setManagerKey] = useState("");
  const [access, setAccess] = useState<VideoAccess | null>(null);
  const [room, setRoom] = useState<VideoRoomInfo | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [pending, setPending] = useState(false);
  const [session, setSession] = useState(0);
  const guard = useRef(false);
  const now = useNow();

  useEffect(() => {
    // Fragment secrets never reach the server, request logs, or referrer headers.
    // Remove from the address bar after capture; reopening the original link works.
    if (guest && window.location.hash)
      window.history.replaceState(null, "", window.location.pathname);
  }, [guest]);

  useEffect(() => {
    if (!guest) return;
    const changed = () => {
      const next = new URLSearchParams(window.location.hash.slice(1)).get("invite");
      if (next) {
        setInvitation(next);
        setAccess(null);
        setRoom(null);
        setError(null);
        window.history.replaceState(null, "", window.location.pathname);
      }
    };
    window.addEventListener("hashchange", changed);
    return () => window.removeEventListener("hashchange", changed);
  }, [guest]);

  useEffect(() => {
    if (!access) return;
    let active = true;
    let refreshing = false;
    const controller = new AbortController();
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const updated =
          access.role === "guest"
            ? await getGuestRoom(access.invitation, controller.signal)
            : await getVideoRoom(access.meetingId, access.key, controller.signal);
        if (active) {
          setRoom(updated);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(err);
          // A temporary CRM outage must not drop an established media call.
          // Definitive access denial immediately removes the room UI/tracks.
          if (err instanceof ApiError && [401, 403, 404, 409].includes(err.status)) setRoom(null);
        }
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(() => void refresh(), 10_000);
    return () => {
      active = false;
      controller.abort();
      window.clearInterval(timer);
    };
  }, [access]);

  async function authenticate() {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setError(null);
    const candidate: VideoAccess = guest
      ? { role: "guest", invitation }
      : { role: "manager", meetingId: meetingId!, key: managerKey.trim() };
    try {
      const result =
        candidate.role === "guest"
          ? await getGuestRoom(candidate.invitation)
          : await getVideoRoom(candidate.meetingId, candidate.key);
      setAccess(candidate);
      setRoom(result);
      setManagerKey("");
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
      guard.current = false;
    }
  }

  const inWindow = room && Date.parse(room.opens_at) <= now && now < Date.parse(room.closes_at);
  return (
    <div className="video-page">
      <header className="video-header">
        <span className="video-brand">
          <Activity size={24} />
          пульс<span>.</span>
        </span>
        <span className="video-private">
          <ShieldCheck size={15} />
          Встреча по приглашению
        </span>
        {!guest && (
          <Link href="/schedule" className="text-link">
            <ArrowLeft size={14} />К расписанию
          </Link>
        )}
      </header>
      <main className="video-content">
        <div className="video-heading">
          <span className="video-eyebrow">
            <Video size={15} />
            Личная видеовстреча
          </span>
          <h1>{room?.company_name ?? (guest ? "Вас пригласили на встречу" : "Будем на связи")}</h1>
          <p>
            {room
              ? `Менеджер: ${room.manager_name}`
              : "Разговор, который помогает двигаться дальше. Аудио и видео — прямо в браузере."}
          </p>
        </div>
        {error != null && <ErrorNotice error={error} />}
        {!access && (
          <form
            className="video-access-card"
            onSubmit={(e) => {
              e.preventDefault();
              void authenticate();
            }}
          >
            <span className="video-access-icon">
              <LockKeyhole size={23} />
            </span>
            <h2>{guest ? "Подключиться как гость" : "Вход менеджера"}</h2>
            <p>
              {guest
                ? "Сначала проверим приглашение. Камера и микрофон останутся выключенными, пока вы сами их не включите."
                : "Введите личный ключ доступа к видеовстречам. Он действует только для встреч вашего менеджера."}
            </p>
            {guest ? (
              !invitation && (
                <ErrorNotice error="В ссылке нет приглашения. Откройте полную ссылку, которую прислал менеджер." />
              )
            ) : (
              <Field
                label="Ключ менеджера"
                htmlFor="video-manager-key"
                hint="Ключ используется в этой вкладке и не сохраняется в браузере."
              >
                <input
                  id="video-manager-key"
                  type="password"
                  autoComplete="off"
                  required
                  maxLength={256}
                  value={managerKey}
                  onChange={(e) => setManagerKey(e.target.value)}
                  placeholder="Личный ключ доступа"
                />
              </Field>
            )}
            <Button
              type="submit"
              loading={pending}
              disabled={guest ? !invitation : !managerKey.trim()}
            >
              {guest ? "Проверить приглашение" : "Открыть встречу"}
            </Button>
          </form>
        )}
        {access && room && (
          <>
            <div className="video-meeting-summary">
              <CalendarDays size={19} />
              <div>
                <strong>{formatDate(room.starts_at, { month: "long", year: "numeric" })}</strong>
                <span>
                  {almatyTime(room.starts_at)}–{almatyTime(room.ends_at)} · Алматы
                </span>
              </div>
              <span className="video-summary-badge">До 2 участников</span>
            </div>
            {access.role === "manager" && (
              <VideoManagement
                room={room}
                managerKey={access.key}
                onChange={setRoom}
                onClosed={() => setSession((s) => s + 1)}
              />
            )}
            {room.closed ? (
              <div className="video-message">
                <Video size={32} />
                <h2>Созвон завершён</h2>
                <p>Комната закрыта. Для новой видеовстречи свяжитесь с менеджером.</p>
              </div>
            ) : !room.room_exists ? (
              <div className="video-message">
                <Video size={32} />
                <h2>Комната ещё не создана</h2>
                <p>Создайте комнату, чтобы подготовить приглашение гостя.</p>
              </div>
            ) : !inWindow ? (
              <div className="video-message">
                <CalendarDays size={32} />
                <h2>
                  {now >= Date.parse(room.closes_at)
                    ? "Время подключения истекло"
                    : "До встречи осталось немного"}
                </h2>
                <p>
                  Вход доступен с {formatDate(room.opens_at, { month: "long" })},{" "}
                  {almatyTime(room.opens_at)} до {almatyTime(room.closes_at)} по Алматы. Комната
                  откроется за 15 минут до встречи.
                </p>
              </div>
            ) : (
              <VideoRoom
                key={`${session}-${room.starts_at}`}
                access={access}
                defaultName={guest ? "" : room.manager_name}
                RoomProvider={RoomProvider}
              />
            )}
          </>
        )}
        <footer className="video-footer">
          <ShieldCheck size={14} />
          Запись созвона не ведётся. Для подключения нужны разрешения браузера и стабильный
          интернет.
        </footer>
      </main>
    </div>
  );
}
