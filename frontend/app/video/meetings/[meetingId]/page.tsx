"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { VideoRoomProvider } from "@/app/providers";

const VideoCallPage = dynamic(() => import("@/pages/video-call").then((m) => m.VideoCallPage), {
  ssr: false,
});

export default function ManagerVideoPage() {
  const params = useParams<{ meetingId: string }>();
  const id = Number(params?.meetingId);
  if (!Number.isSafeInteger(id) || id <= 0) return <p>Некорректный номер встречи.</p>;
  return <VideoCallPage key={id} meetingId={id} RoomProvider={VideoRoomProvider} />;
}
