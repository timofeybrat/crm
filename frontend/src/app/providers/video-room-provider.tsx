"use client";

import { LiveKitRoom, type LiveKitRoomProps } from "@livekit/components-react";
import type { ReactNode } from "react";

// The route injects this provider into the page; lower FSD layers never import app.
export function VideoRoomProvider(props: LiveKitRoomProps & { children: ReactNode }) {
  return <LiveKitRoom {...props} />;
}
