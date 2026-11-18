"use client";

import { useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  ConnectionQualityIndicator,
  ConnectionStateToast,
  DisconnectButton,
  GridLayout,
  ParticipantTile,
  PreJoin,
  RoomAudioRenderer,
  StartAudio,
  TrackToggle,
  useConnectionState,
  useParticipants,
  useTracks,
  useLocalParticipant,
  type LiveKitRoomProps,
  type LocalUserChoices,
} from "@livekit/components-react";
import { ConnectionState, Track } from "livekit-client";
import { Camera, Mic, PhoneOff, Radio, Users } from "lucide-react";
import { joinVideoRoom, type VideoAccess, type VideoConnection } from "@/entities/video-call";
import { Button, ErrorNotice, Loading } from "@/shared/ui";

export type RoomProviderComponent = ComponentType<LiveKitRoomProps & { children: ReactNode }>;

function Conference() {
  const tracks = useTracks([{ source: Track.Source.Camera, withPlaceholder: true }]);
  const participants = useParticipants();
  const { localParticipant } = useLocalParticipant();
  const state = useConnectionState();
  const [deviceError, setDeviceError] = useState(false);
  return (
    <>
      <div className="video-call-status" role="status">
        <span>
          <Radio size={15} />
          {state === ConnectionState.Connected
            ? "Вы в эфире"
            : state === ConnectionState.Reconnecting || state === ConnectionState.SignalReconnecting
              ? "Восстанавливаем соединение…"
              : "Подключаемся…"}
        </span>
        <span>
          <Users size={15} />
          {participants.length}/2
        </span>
      </div>
      <div className="video-stage">
        <GridLayout tracks={tracks}>
          <ParticipantTile />
        </GridLayout>
        {participants.length < 2 && (
          <p className="video-waiting">
            Ожидаем второго участника. Приглашение можно отправить заранее.
          </p>
        )}
      </div>
      <RoomAudioRenderer />
      <StartAudio label="Включить звук участников" />
      <ConnectionStateToast />
      {deviceError && (
        <ErrorNotice error="Не удалось включить устройство. Проверьте разрешения браузера или продолжите без камеры и микрофона." />
      )}
      <div className="video-controls">
        <TrackToggle
          source={Track.Source.Microphone}
          showIcon={false}
          onDeviceError={() => setDeviceError(true)}
        >
          <Mic size={18} />
          Микрофон
        </TrackToggle>
        <TrackToggle
          source={Track.Source.Camera}
          showIcon={false}
          onDeviceError={() => setDeviceError(true)}
        >
          <Camera size={18} />
          Камера
        </TrackToggle>
        <ConnectionQualityIndicator
          participant={localParticipant}
          aria-label="Качество соединения"
        />
        <DisconnectButton>
          <PhoneOff size={18} />
          Выйти
        </DisconnectButton>
      </div>
    </>
  );
}

export function VideoRoom({
  access,
  defaultName,
  RoomProvider,
}: {
  access: VideoAccess;
  defaultName: string;
  RoomProvider: RoomProviderComponent;
}) {
  const [choices, setChoices] = useState<LocalUserChoices | null>(null);
  const [connection, setConnection] = useState<VideoConnection | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [left, setLeft] = useState(false);
  const guard = useRef(false);

  async function join(values: LocalUserChoices) {
    if (guard.current) return;
    guard.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await joinVideoRoom(access, values.username.trim());
      setChoices(values);
      setConnection(result);
      setLeft(false);
    } catch (err) {
      setError(err);
    } finally {
      setPending(false);
      guard.current = false;
    }
  }

  if (connection && choices)
    return (
      <div className="video-conference" data-lk-theme="default">
        <RoomProvider
          serverUrl={connection.server_url}
          token={connection.participant_token}
          audio={choices.audioEnabled ? { deviceId: choices.audioDeviceId } : false}
          video={choices.videoEnabled ? { deviceId: choices.videoDeviceId } : false}
          options={{ adaptiveStream: true, dynacast: true }}
          onDisconnected={() => {
            setConnection(null);
            setChoices(null);
            setLeft(true);
          }}
          onError={() =>
            setError("Соединение с комнатой не установлено. Проверьте сеть и повторите вход.")
          }
          onMediaDeviceFailure={() =>
            setError("Нет доступа к камере или микрофону. Проверьте разрешения браузера.")
          }
        >
          <Conference />
          {error != null && (
            <>
              <ErrorNotice error={error} />
              <Button
                variant="secondary"
                onClick={() => {
                  setConnection(null);
                  setChoices(null);
                }}
              >
                Вернуться к проверке устройств
              </Button>
            </>
          )}
        </RoomProvider>
      </div>
    );

  return (
    <section className="video-lobby" data-lk-theme="default" aria-label="Проверка перед входом">
      {left && (
        <p className="video-left" role="status">
          Вы вышли из созвона. Для повторного входа доступ будет проверен заново.
        </p>
      )}
      <h2>Проверим звук и камеру</h2>
      <p>Выберите устройства. Можно войти с выключенной камерой и микрофоном.</p>
      {error != null && <ErrorNotice error={error} />}
      <label htmlFor="username" className="sr-only">
        Ваше имя
      </label>
      {pending ? (
        <Loading label="Подключаем к комнате…" />
      ) : (
        <PreJoin
          defaults={{ username: defaultName, audioEnabled: false, videoEnabled: false }}
          persistUserChoices={false}
          joinLabel="Присоединиться"
          micLabel="Микрофон"
          camLabel="Камера"
          userLabel="Ваше имя"
          onValidate={(v) => v.username.trim().length > 0 && v.username.trim().length <= 80}
          onError={() =>
            setError(
              "Устройство недоступно. Разрешите доступ в браузере или войдите без камеры и микрофона.",
            )
          }
          onSubmit={(values) => void join(values)}
        />
      )}
    </section>
  );
}
