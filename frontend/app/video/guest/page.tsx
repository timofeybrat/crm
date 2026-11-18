"use client";

import dynamic from "next/dynamic";
import { VideoRoomProvider } from "@/app/providers";

const VideoCallPage = dynamic(() => import("@/pages/video-call").then((m) => m.VideoCallPage), {
  ssr: false,
});

export default function GuestVideoPage() {
  return <VideoCallPage RoomProvider={VideoRoomProvider} />;
}
